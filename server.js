const express = require("express");
const logger = require("morgan");
const mongoose = require("mongoose");

// Our scraping tools
// Axios is a promised-based http library, similar to jQuery's Ajax method
// It works on the client and on the server
const axios = require("axios");
const cheerio = require("cheerio");

// Require all models
const db = require("./models");

const PORT = 3003;

// Initialize Express
const app = express();

// Configure middleware

// Use morgan logger for logging requests
app.use(logger("dev"));
// Parse request body as JSON
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
// Make public a static folder
app.use(express.static("public"));

// Connect to the Mongo DB
var MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost/NewsScraper"

mongoose.connect(MONGODB_URI)

// Routes

// A GET route for scraping the Huffington Post website
app.get("/scrape", (req, res) => {
    // First, we grab the body of the html with axios
    axios.get("https://www.huffpost.com/").then(response => {
        // Then, we load that into cheerio and save it to $ for a shorthand selector
        const $ = cheerio.load(response.data);

        // Now, we grab headline within an article tag, and do the following:
        
        $(".card--left").each((i, element) => {
            //Save empty result object
            const result = {};
            result.title = $(element).children(".card__content").children(".card__details").children(".card__headlines")
                .children(".card__headline").children("a").children(".card__headline__text").text();
            result.image = $(element).children(".card__content").children(".card__image__wrapper").children(".card__image").children("img").attr("src")
            result.link = $(element).children(".card__content").children(".card__details").children(".card__headlines")
                .children(".card__headline").children("a").attr("href")

            
            // Create a new Article using the `result` object built from scraping
            db.Article.create(result)
                .then(dbArticle => {
                    // View the added result in the console
                    console.log(dbArticle);
                })
                .catch(err => {
                    // If an error occurred, log it
                    console.log(err);
                });
        });

        // Send a message to the client
        res.send("Scrape Complete");
    });
});

// Route for getting all Articles from the db
app.get("/articles", (req, res) => {
    // Grab every document in the Articles collection
    db.Article.find({})
        .then(dbArticle => {
            // If we were able to successfully find Articles, send them back to the client
            res.json(dbArticle);
        })
        .catch(err => {
            // If an error occurred, send it to the client
            res.json(err);
        });
});

// Route for grabbing a specific Article by id, populate it with it's note
app.get("/articles/:id", (req, res) => {
    // Using the id passed in the id parameter, prepare a query that finds the matching one in our db...
    db.Article.findOne({ _id: req.params.id })
        // ..and populate all of the notes associated with it
        .populate("note")
        .then(dbArticle => {
            // If we were able to successfully find an Article with the given id, send it back to the client
            res.json(dbArticle);
        })
        .catch(err => {
            // If an error occurred, send it to the client
            res.json(err);
        });
});

// Route for saving/updating an Article's associated Note
app.post("/articles/:id", (req, res) => {
    // Create a new note and pass the req.body to the entry
    db.Note.create(req.body)
        .then(dbNote => {
            // If a Note was created successfully, find one Article with an `_id` equal to `req.params.id`. Update the Article to be associated with the new Note
            // { new: true } tells the query that we want it to return the updated User -- it returns the original by default
            // Since our mongoose query returns a promise, we can chain another `.then` which receives the result of the query
            return db.Article.findOneAndUpdate({ _id: req.params.id }, { note: dbNote._id }, { new: true });
        })
        .then(dbArticle => {
            // If we were able to successfully update an Article, send it back to the client
            res.json(dbArticle);
        })
        .catch(err => {
            // If an error occurred, send it to the client
            res.json(err);
        });
});

// Start the server
app.listen(PORT, () => {
    console.log(`App running on port ${PORT}!`);
});
