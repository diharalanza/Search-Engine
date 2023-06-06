const Crawler = require("crawler");
const mongoose = require('mongoose');
const ObjectId = require('mongoose').Types.ObjectId
const config = require('./config.js');
let FruitPage = require("./models/fruitPageModel");
let MyPage = require("./models/myPageModel");
const {Matrix} = require("ml-matrix");
const express = require("express");
const app = express();
const path = require('path');
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());
app.use(express.urlencoded({extended: true}));

app.set("view engine", "ejs");

let seed_fruit = 'https://people.scs.carleton.ca/~davidmckenney/fruitgraph/N-0.html';

// used to keep track of visited pages
let allLinks_fruit = []
let P_fruit;
let pages_fruit;
let n_fruit;

// used to keep track of visited pages
let allLinks_my = []
let P_my;
let pages_my;
let n_my;

// needed for matrix calculations
let a = 0.1
let convergenceVal = 0.0001

mongoose.connect(config.db.host, {
    useNewUrlParser: true,
    useUnifiedTopology: true
});

process.on('SIGINT', function () { // drop the collection when server closes
    mongoose.connection.dropCollection('fruitpages', function (err, result) {});
    mongoose.connection.dropCollection('mypages', function (err, result) {});

    mongoose.connection.close(function () {
        console.log("Mongoose disconnected through app termination");
        process.exit(0);
    });
});

// used to provide the client.js file
var fs = require('fs');
function serveScript(req, res, next) {
    res.writeHead(200, {'content-type': 'application/javascript'});
    fs.createReadStream("./views/pages/client.js").pipe(res);
}
app.use('/client.js', serveScript);

// initializing index for searching
const elasticlunr = require("elasticlunr");
const index_fruit = elasticlunr(function () {
    this.addField('title');
    this.addField('content');
    this.setRef('id');
});
const index_my = elasticlunr(function () {
    this.addField('title');
    this.addField('content');
    this.setRef('id');
});

const c_fruit = new Crawler({
    maxConnections: 100,
    // use this for parallel, rateLimit for individual
    // rateLimit: 1000,

    // This will be called for each crawled page
    callback: function (error, res, done) {
        if (error) {
            console.log(error);
        } else {
            let $ = res.$; // get cheerio data, see cheerio docs for info
            let title = $("title").text();
            let paragraph = $("p").text();
            let links = $("a");
            let outgoingLinks = [];

            $(links).each(function (i, link) { // push all links in page to its outgoinglinks array
                outgoingLinks.push(`https://people.scs.carleton.ca/~davidmckenney/fruitgraph/${
                    $(link).text()
                }.html`);

                // if not already visited, then queue the current link
                if (! allLinks_fruit.includes(`https://people.scs.carleton.ca/~davidmckenney/fruitgraph/${
                    $(link).text()
                }.html`)) {
                    c_fruit.queue(`https://people.scs.carleton.ca/~davidmckenney/fruitgraph/${
                        $(link).text()
                    }.html`)
                    allLinks_fruit.push(`https://people.scs.carleton.ca/~davidmckenney/fruitgraph/${
                        $(link).text()
                    }.html`)
                }
            })
            // create a new doc to save to db
            let newPage = new FruitPage({
                url: res.options.uri,
                title: title,
                content: paragraph,
                outgoingLinks: outgoingLinks,
                incomingLinks: [],
                pageScore: 0
            })
            newPage.save();

            // adding this doc to index
            let doc = {
                title: "",
                content: "",
                id: ""
            }
            doc.title = title;
            doc.content = paragraph;
            doc.id = newPage._id;

            index_fruit.addDoc(doc)
        } done();
    }
});

// Queue a URL, which starts the crawl
c_fruit.queue(seed_fruit);
// pushes this cause now visited
allLinks_fruit.push(seed_fruit);

// after getting outgoinglinks for all pages, use the data to find incominglinks for each page
async function updateIncomingLinks_fruit() {

    console.log("updating incoming links for all pages...")
    pages_fruit = await FruitPage.find({})

    for (link of allLinks_fruit) {
        let incomingLinks = []
        for (page in pages_fruit) {
            if (pages_fruit[page].outgoingLinks.includes(link)) {
                incomingLinks.push(pages_fruit[page].url)
            }
        }

        let foundPage = await FruitPage.findOne({url: link});
        foundPage.incomingLinks = incomingLinks;
        foundPage.save();
    }
}

function converged(x0, x0_old) {
    for (let i = 0; i < n_fruit; i++) { // if the difference of any entry from x0 new and old is greater than the convergence value, return false
        if (Math.abs(x0.get(0, i) - x0_old.get(0, i)) >= convergenceVal) {
            return false;
        }
    }
    // if reached here, means none of the differences is greater or equal to the convergence value
    return true;
}

function pageRank_fruit() { // steady-state vector
    let x0 = [];
    // first entry will be 1
    let x = [1];
    // rest of entries will be 0
    for (let i = 0; i < n_fruit - 1; i++) {
        x.push(0)
    }
    x0.push(x)
    x0 = new Matrix(x0);

    // Power iteration
    // keeps multiplying until difference is less than 0.0001 which means it has converged
    // x0_old will hold old matrix to compare if difference is negligible
    let x0_old;

    while (true) {
        x0_old = x0;
        x0 = x0.mmul(P_fruit);
        // if converged, break the loop
        if (converged(x0, x0_old)) {
            x0 = x0_old;
            break;
        }
    }

    // saves each pages pageRank score in mongoDB
    for (page in pages_fruit) {
        pages_fruit[page].pageRankScore = x0.get(0, page);
        pages_fruit[page].save();
    }
}

async function makeMatrix_fruit() {
    console.log("getting pageRank scores...")

    // loads all documents from mongoDB
    n_fruit = pages_fruit.length;

    let rows = []

    for (let i = 0; i < n_fruit; i++) {

        let row = [];
        for (let j = 0; j < n_fruit; j++) { // if entry[j]'s link is in entry[i]'s outgoing links, append 1, else 0
            if (pages_fruit[i].outgoingLinks.includes(pages_fruit[j].url)) {
                row.push(1)
            } else {
                row.push(0)
            }
        }

        // checks if there is no 1's in the row
        if (! row.includes(1)) {
            // if no 1's, then replace each entry with 1/n since its a sink node
            // multiply by (1-a) and add a/n (teleport probability)
            row = row.map(function (entry) {
                return entry = (1 / n_fruit * (1 - a)) + (a / n_fruit)
            });
        } else { // if theres atleast one 1, replace each entry by entry/number of ones to get probabilty of going to that node
            numOfOnes = row.filter(entry => entry === 1).length
            // multiply by (1-a) and add a/n (teleport probability)
            row = row.map(function (entry) {
                return entry = (entry / numOfOnes * (1 - a)) + (a / n_fruit)
            });
        }
        // adds row to the matrix
        rows.push(row)

    }
    // populates P with the matrix created
    P_fruit = new Matrix(rows)

    pageRank_fruit()
}

// Triggered when the queue becomes empty
// when queue is empty, all pages have beed visited Now update incomingLinks property.
c_fruit.on('drain', async function () {
    await updateIncomingLinks_fruit();
    await makeMatrix_fruit();
    console.log("Done.");
});

// setting up the search page when requested
app.get("/fruits", getFruitSearchPage);
async function getFruitSearchPage(req, res, next) {

    let results = await index_fruit.search(req.query.q, {});
    console.log("searching for: "+req.query.q);

    let data = {};

    let resultsToSend = [];

    // appends first "limit" entries to resultsToSend
    if (results != "") {

        if(req.query.boost == "true"){
            console.log("boost = ON")
            for (let result = 0; result < results.length; result++) {
                let foundResult = pages_fruit.find(page => page._id.toString() === results[result].ref.toString());
                results[result].score = results[result].score * foundResult.pageRankScore
            }

            results = results.sort((a, b) => b.score - a.score);
        }
        else{
            console.log("boost = OFF")
        }
        
        console.log("number of results: "+req.query.limit)

        for (let result = 0; result < req.query.limit; result++) {
 
            let foundResult = pages_fruit.find(page => page._id.toString() === results[result].ref.toString());

            console.log(foundResult._id)
            console.log(foundResult.url)
            console.log(foundResult.title)
            console.log(results[result].score)
            console.log("--------------------------")

            let aResult = {
                _id: foundResult._id,
                url: foundResult.url,
                title: foundResult.title,
                pageRankScore: foundResult.pageRankScore,
                score: results[result].score
            }
            resultsToSend.push(aResult)
        }
    }

    data.q = req.query.q;
    data.boost = req.query.boost;
    data.limit = req.query.limit;
    data.resultsToSend = resultsToSend;

    res.format({
        "application/json": () => {
            res.status(200).json(data);
        },
        "text/html": () => {
            res.render("pages/fruitsSearch", {data: data});
        }
    });
}

//returns an object that has frequency of each word in a string
function wordFreq(string) {
    var words = string.replace(/[.]/g, '').split(/\s/);
    var freqMap = {};
    words.forEach(function(w) {
        if (!freqMap[w]) {
            freqMap[w] = 0;
        }
        freqMap[w] += 1;
    });

    return freqMap;
}

//gets info for each document
app.get("/fruits/:pageId", getPageData, sendPageData);
function getPageData(req, res, next){

	var id = req.params.pageId;
    
    //uses the documents _id attr to find page to show incoming links of said page
	FruitPage.find().where("_id").equals(ObjectId(id)).exec(function(err, results){
      if(err){
        res.status(500).send("Error reading pages.");
        console.log(err);
        return;
      }

      let data = {}
      console.log("page found: "+results)
      //data._id = results[0]._id;
      data.url = results[0].url;
      data.title = results[0].title;
      data.incoming = results[0].incomingLinks;
      data.outgoing = results[0].outgoingLinks;
      data._id = results[0]._id;
      data.words = wordFreq(results[0].content.trim());

      console.log("word freq: "+ data.words)
      
      res.data = data;
      next();
	})
}

function sendPageData(req, res, next){
	res.format({
		"application/json": () => { res.status(200).json(res.data); },
		"text/html": () => { res.render("pages/pageData", {data: res.data}); }
	});
    next()
}

app.listen(3000);
