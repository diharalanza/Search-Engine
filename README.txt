
Instructions:
npm install
node server.js 

Overview:
This project aims to implement a web crawler-based search engine with PageRank ranking, as part of a course assignment. The search engine is designed to crawl and index web pages, allowing users to perform searches and retrieve relevant results based on their queries. The project consists of three main components: a web crawler, a RESTful server, and a browser-based client.

Features:

Web Crawler: The web crawler is responsible for crawling a fruit example site. It retrieves web pages, stores them in a database for persistence, and calculates the PageRank score for each page.
RESTful Server: The RESTful server reads the data from the database, performs necessary indexing, and provides search functionality. It supports two search endpoints (/fruits and /personal) for searching the fruit example site and the additional site respectively. Users can specify search queries, enable/disable PageRank boosting, and set the number of desired search results.
Browser-based Client: The browser-based client serves as the user interface for interacting with the search engine. It allows users to enter search queries, customize PageRank boosting preferences, and specify the number of search results they want to receive.
Search Results:
The search results displayed in the browser include the URL and title of the original page, the PageRank score within the crawled network, and a link to view detailed data about the page. The detailed data includes the URL, title, incoming and outgoing links, word frequency information, and any additional data generated during the crawl.




