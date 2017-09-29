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

// Set Handlebars
var exphbs = require("express-handlebars");
app.set('views', './views')
app.engine("hbs", exphbs({
  defaultLayout: "main",
  extname: '.hbs'
}));
app.set("view engine", ".hbs");

// Database configuration with mongoose
mongoose.connect("mongodb://localhost/slashdot-scraper");
var db = mongoose.connection;

// Show any mongoose errors
db.on("error", function (error) {
  console.log("Mongoose Error: ", error);
});

// Once logged in to the db through mongoose, log a success message
db.once("open", function () {
  console.log("Mongoose connection successful.");
});

// ROUTES
// Default Home view
app.get("/", function (req, res) {
  // fetch articles from db
  Article.find({})
  .sort({ dateCreated: 1 })
  .exec(function (error, doc) {
    // Log any errors
    if (error) {
      console.log("Error retrieving from db:", error);
    }
    else {
      // wrap the response for handlebars' benefit
      var hbObject = {
        articles: doc
      }
      res.render('index', hbObject);
    }
  });
});

// Scrape
app.get("/scrape", function (req, res) {
  // Point request current page at SlashDot
  request("https://slashdot.org/", function (error, response, html) {
    if (error) {
      console.log("Request error:", error);
    }
    // Hand it to cheerio and assign to "$"
    var $ = cheerio.load(html);
    // To avoid sponsored advertisement articles, select only articles with ids
    $("article[id]").each(function (i, element) {
      var result = {};
      // Harvest the relevant portions of every article
      // Drop the read count after the title
      result.title = $(element).find("h2 span a").text().split(")")[0] + ")";
      result.link = $(element).find("h2 span a").attr("href");
      result.summary = $(element).find("div.p").text().trim();
      // Mongoose model powers activate! Form of: Article!
      // To avoid adding duplicate entries, the "update" method creates a new document only if no matching title is found.
      Article.update({title: result.title}, result, {new: true, upsert: true, setDefaultsOnInsert: true}, function(err, doc) {

      // var entry = new Article(result);
      // save to db
      // entry.save(function (err, doc) {
      //   // Log any errors
      //   if (err) {
      //     // console.log("Saving error:", err);
      //   }
      //   // Or log the doc
      //   else {
      //     // console.log("Scrape results:", doc);
      //   }
      });
    });
    // redirect to render with new results
    res.redirect("/");
  });
});

// Render "Saved" list
app.get("/saved", function (req, res) {
  Article.find({ "saved": true })
    .populate("comment")
    .exec(function (err, doc) {
      if (err) {
        console.log(err);
      } else {
        console.log(doc);
        var hbObject = {
          articles: doc
        }
        console.log('hbObject:', hbObject);
        res.render('saved', hbObject);
      }
    });
});

// // GET individual article
// app.get("/articles/:id", function(req, res) {
//   // Using the id passed in the id parameter, prepare a query that finds the matching one in our db...
//   Article.findOne({ "_id": req.params.id })
//   // ..and populate all of the articles associated with it
//   .populate("comment")
//   // now, execute our query
//   .exec(function(error, doc) {
//     // Log any errors
//     if (error) {
//       console.log(error);
//     }
//     // Otherwise, send the doc to the browser as a json object
//     else {
//       res.json(doc);
//     }
//   });
// });

// Add an article to "saved" list
app.post("/:id", function (req, res) {
  // grab specific article from the db, then either add it to or remove it from the "saved" list based on the Boolean passed
  Article.findOneAndUpdate({ "_id": req.params.id }, { "saved": req.body.saved })
    .exec(function (err, doc) {
      if (err) {
        console.log(err);
      } else {
        console.log('doc', doc)
        res.redirect('/');
      }
    })
});

// Create a new comment or replace an existing comment
app.post("/saved/:id", function (req, res) {
  // Create a new comment and pass the req.body to the entry
  var newComment = new Comment(req.body);
  // And save the new comment the db
  newComment.save(function (error, doc) {
    // Log any errors
    if (error) {
      console.log(error);
    }
    // Otherwise
    else {
      // Use the article id to find and update its comment
      Article.findOneAndUpdate({ "_id": req.params.id }, { "comment": doc._id })
        // Execute the above query
        .exec(function (err, doc) {
          // Log any errors
          if (err) {
            console.log(err);
          }
          else {
            // Or send the document to the browser
            // res.redirect("/saved") maybe?
            res.send(doc);
          }
        });
    }
  });
});

var PORT = 3000;
app.listen(3000, function () {
  console.log("App running on port", PORT);
});