const mongoose = require("mongoose");
const Schema = mongoose.Schema;

let FruitPageSchema = Schema({

    url:{
        type: String,
        required: true
    },

	content: {
		type: String,
		required: true
	},
    title: {
		type: String,
	},
    outgoingLinks:{
        type: [String]
    
    },
    incomingLinks:{
        type: [String]
       
    },
    pageRankScore: {
        type: Number
    }
	
});

module.exports = mongoose.model("FruitPage", FruitPageSchema);
