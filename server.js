// Connect to database
require('./config/Db');

const express = require('express');
const app = express();

const port = process.env.PORT || 3000;

const cors = require("cors");
const http = require("http");

const { Server } = require("socket.io");

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*"
  }
});

global.io = io;

io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  socket.on("join", (userId) => {
    socket.join(userId); // كل user في room خاصة به
  });

  socket.on("disconnect", () => {
    console.log("User disconnected");
  });
});





app.use(cors({
  origin: "*",        // السماح لأي origin
  credentials: true   // للحالات التي تحتاج إرسال cookies أو authorization headers
}));
// -------- Middleware --------
// Parse incoming JSON
app.use(express.json());

// -------- Routes --------
const userRouter = require('./api/User');
const propretyRouter = require('./api/Proprety');
const notificationRouter = require('./api/notification');


// All routes start with /user
app.use('/user', userRouter);
app.use('/proprety', propretyRouter);
app.use('/notification', notificationRouter);

app.use(express.static("public"));

// -------- Start Server --------
server.listen(port, () => {
    console.log(`Server running on port ${port}`);
});