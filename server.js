'use strict';
require('dotenv').config();

const express = require('express');
const app = express();
const bodyParser = require('body-parser');

const cors = require('cors');

const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const shortid = require('shortid');

// Connect to DB.
mongoose.connect(
    process.env.MONGO_URI || process.env.MONGO_LOCAL,
    { useNewUrlParser: true }
);
app.use(cors());

app.use(bodyParser.urlencoded({extended: false}));
app.use(bodyParser.json());

// Apis and Microservices Projects - Exercise Tracker
// Schemas
const ExerciseSchema = new Schema({
  description: { type: String, required: true },
  duration: { type: Number, required: true },
  date: { type: Date, default: Date.now }
});
const UserSchema = new Schema({
  _id: {
    type: Schema.Types.Mixed,
    default: shortid.generate
  },
  username: { type: String, required: true },
  exercises: [ExerciseSchema]
});
const User = mongoose.model('User', UserSchema);

// Default Public Path.
app.use(express.static('public'));
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/views/index.html')
});


// Apis and Microservices Projects - Exercise Tracker

// Create new User
app.post('/api/exercise/new-user', async function (req, res) {
  if (req.body.username) {
    let existingUser = await findUserByName(req.body.username);
    console.log(existingUser);
    if (!existingUser) {
      const userToSave = new User({
        username: req.body.username
      });
      userToSave.save((err, data) => {
        err ? res.json({error: 'save failure'}) :
            res.json({
              "username": data.username,
              "_id": data._id
            });
      });
    }
    else {
      res.json({error: 'user exists'})
    }
  }
});

// Add exercise.
app.post('/api/exercise/add', async function (req, res) {
  if (req.body.userId) {
    let userToAddExercise = await findUserById(req.body.userId);
    if (userToAddExercise) {
      console.log(userToAddExercise);
      if (req.body.description && req.body.duration) {
        const exercise = {
          description: req.body.description,
          duration: req.body.duration,
        };
        if (isDateValid(req.body.date)) exercise.date = new Date(req.body.date);
        userToAddExercise.exercises.push(exercise);
        userToAddExercise.save((err, data) => {
          err ? res.json({error: 'exercise save failure'}) :
              res.send(data);
        });
      }
      else {
        res.json({error: 'description or duration missing'})
      }
    }
    else {
      res.json({error: 'user not found'})
    }
  }
});

// Get list of all users.
app.get('/api/exercise/users', (req, res) => {
  User.find((err, data) => {
    if (err || !data) {
      res.json({error: 'error retrieving users'})
    }
    else {
      const users = data.map(item => {
        return {
          "username": item.username,
          "_id": item._id
        }
      });
      console.log(users);
      res.send(users);
    }
  });
});

// Get (filtered) list of exercises for userId.
app.get('/api/exercise/log', async function (req, res) {
  if (req.query.userId) {
    let userExercised = await findUserById(req.query.userId);
    if (userExercised) {
      let exercises = userExercised.exercises;
      const totalExerciseCount = exercises.length;

      const fromDate = new Date(req.query.from);
      const toDate = new Date(req.query.to);
      const limit = Number(req.query.limit);

      // Was an optional from (Date) given?
      if(isDateValid(fromDate)){
        exercises = exercises.filter(
            (item) => (item.date >= fromDate)
        );
      }
      // Was an optional to (Date) given?
      if (isDateValid(toDate)){
        exercises = exercises.filter(
            (item) => (item.date <= toDate)
        );
      }
      // Was an optional limit given? Then apply if applicable.
      if (!isNaN(limit) && exercises.length > limit){
        exercises = exercises.slice(0, limit);
      }

      // Clean up Exercises.
      const userExercises = exercises.map(item => {
        return {
          "description": item.description,
          "duration": item.duration,
          "date": item.date
        }
      });
      // Build User Object.
      const userObject = {
        "username": userExercised.username,
        "_id": userExercised._id,
        "total_exercise_count": totalExerciseCount,
        userExercises
      };
      // And return.
      res.json(userObject);
    }
  }
  else {
    res.json({error: 'user not found'})
  }
});

// Checks if a Date is Valid.
function isDateValid(date) {
  return date instanceof Date && !isNaN(date);
}

// Async function to get User by username.
function findUserByName(username) {
  return new Promise((resolve, reject) => {
    User.findOne(
        {username: username},
        (err, user) => err ? reject(null) : resolve(user)
    );
  });
}

// Async function to get User by userid.
function findUserById(userid) {
  return new Promise((resolve, reject) => {
    User.findById(
        userid,
        (err, user) => err ? reject(null) : resolve(user)
    );
  });
}

// Not found middleware
app.use((req, res, next) => {
  return next({status: 404, message: 'not found'})
});

// Error Handling middleware
app.use((err, req, res, next) => {
  let errCode, errMessage;

  if (err.errors) {
    // mongoose validation error
    errCode = 400; // bad request
    const keys = Object.keys(err.errors);
    // report the first validation error
    errMessage = err.errors[keys[0]].message
  } else {
    // generic or custom error
    errCode = err.status || 500;
    errMessage = err.message || 'Internal Server Error'
  }
  res.status(errCode).type('txt')
    .send(errMessage)
});

const listener = app.listen(process.env.PORT || 3000, () => {
  console.log('Your app is listening on port ' + listener.address().port)
});
