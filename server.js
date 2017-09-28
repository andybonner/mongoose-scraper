// Dependencies
// TODO: Hey, can I convert to "import" without breaking anything?
var express = require("express");
var bodyParser = require("body-parser");
var logger = require("morgan");
var mongoose = require("mongoose");
// Requiring our Comment and Article models
var Comment = require("./models/Comment");
var Article = require("./models/Article");
// Our scraping tools
var request = require("request");
var cheerio = require("cheerio");
// Set mongoose to leverage built in JavaScript ES6 Promises
mongoose.Promise = Promise;


// Initialize Express
var app = express();

// Use morgan and body parser with our app
app.use(logger("dev"));
app.use(bodyParser.urlencoded({
  extended: false
}));

// Make public a static dir
app.use(express.static("public"));

// Database configuration with mongoose
mongoose.connect("mongodb://localhost/slashdot-scraper");
var db = mongoose.connection;

// Show any mongoose errors
db.on("error", function(error) {
  console.log("Mongoose Error: ", error);
});

// Once logged in to the db through mongoose, log a success message
db.once("open", function() {
  console.log("Mongoose connection successful.");
});

// ROUTES
// Default Home view
app.get("/", function(req, res) {
  // fetch articles from db
  Article.find({}, function(error, doc) {
    // Log any errors
    if (error) {
      console.log("Error retrieving from db:", error);
    }
    // Or send the doc to the browser as a json object
    else {
      res.json(doc);
    }
  });
})

// Scrape
app.get("/scrape", function(req, res) {
  // Point request current page at SlashDot
  request("https://slashdot.org/", function(error, response, html) {
    if (error) {
      console.log("Request error:", error);
    }
    // Hand it to cheerio and assign to "$"
    var $ = cheerio.load(html);
    // To avoid sponsored advertisement articles, select only articles with ids
    // TODO: change back to article[id]
    $("article").each(function(i, element) {
      var result = {};
      // Harvest the relevant portions of every article
      result.title = $(this).find("h2 span a").text();
      result.link = $(this).find("h2 span a").attr("href");
      result.summary = $(this).find("div").text();
      // Using regex, trim the parentheses from the name of the story's source
      result.source = $(this).find("a.story-sourcelnk").text().replace(/\(|\)/g, "");
      console.log("result:", result);
      // Mongoose model powers activate! Form of: Article!
      var entry = new Article(result);
      // save to db
      entry.save(function(err, doc) {
        // Log any errors
        if (err) {
          console.log("Saving error:", err);
        }
        // Or log the doc
        else {
          console.log("Scrape results:", doc);
        }
      });

    });
  });
  // redirect to render with new results
  res.redirect("/");
});

var PORT = 3000;
app.listen(3000, function() {
  console.log("App running on port", PORT);
});