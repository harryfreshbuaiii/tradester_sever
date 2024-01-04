const express = require("express");
const app = express();
const cors = require("cors");
const mongoose = require("mongoose");
const dotenv = require("dotenv");
const connectDB = require("./config/db");
const http = require("http");
const server = http.createServer(app);
const routes = require("./api/routes");
const { updateNews, updateRate } = require("./utils.js/util");

dotenv.config();
connectDB();

app.use(cors());
app.use(express.json());
app.use("/uploads", express.static("uploads"));
app.use("/assets", express.static("assets"));
app.use("/api", routes);
app.set("view engine", "ejs");
app.set("views", "views_directory");
updateNews();
updateRate();

const PORT = process.env.PORT;
server.listen(
  PORT,
  console.log(`Server running on PORT ${PORT}...`.yellow.bold)
);

