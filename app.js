const express = require('express')
const app = express()
http = require('http')
const port = 3000
const T = require('tesseract.js')
const googleTTS = require('google-tts-api')
const path = require('path')
var fluent_ffmpeg = require('fluent-ffmpeg')
var mergedVideo = fluent_ffmpeg()
var audioconcat = require('audioconcat')
const multer = require('multer')
const directory = './public/audio'
const helpers = require('./helpers')
app.set('view engine', 'html')
app.engine('html', require('ejs').renderFile)
let songLength
//---
var fs = require('fs'),
  request = require('request')
//
let extratedImage
let songs = []
//-------------------------set up location for the images---------------------------------------
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, `./public/image`)
  },

  // By default, multer removes file extensions so let's add them back
  filename: function (req, file, cb) {
    cb(
      null,
      file.fieldname + '-' + Date.now() + path.extname(file.originalname),
    )
  },
})
//----------------------------------------------------------------
app.use(express.static(path.join(__dirname, 'public')))

app.get('/', (req, res) => {
  removeSongs()
  res.render(`${__dirname}/views/home.ejs`)
})

app.post('/convert', (req, res) => {
  // 'profile_pic' is the name of our file input field in the HTML form
  let upload = multer({
    storage: storage,
    fileFilter: helpers.imageFilter,
  }).single('image')

  upload(req, res, function (err) {
    // req.file contains information of uploaded file
    // req.body contains information of text fields, if there were any

    if (req.fileValidationError) {
      return res.send(req.fileValidationError)
    } else if (!req.file) {
      return res.send('Please select an image to upload')
    } else if (err instanceof multer.MulterError) {
      return res.send(err)
    } else if (err) {
      return res.send(err)
    }

    // Display uploaded image for user validation
    var ret = req.file.path.replace('public', '') // remove public from the path so image can show up in html
    //---------------------setting up the image to text-------------------------------------------
    T.recognize(req.file.path, 'eng', {
      logger: (e) => e,
    }).then((out) => {
      extratedImage = out.data.text
      //console.log(extratedImage)

      //------------------------settings up the audio to read the text----------------------------------------
      const url = googleTTS.getAllAudioUrls(extratedImage, {
        lang: 'en',
        slow: false,
        host: 'https://translate.google.com',
        timeout: 10000,
        splitPunct: ',.?•-',
      })

      // ----------------------save all links from the audio link to the audio array--------------------
      for (var i = 0; i < url.length; i++) {
        request
          .get(url[i].url)
          .on('error', function (err) {
            // handle error
          })
          .pipe(fs.createWriteStream(`./public/audio/${i}.mp3`)) //downloads the audio files
        songs.push(`./public/audio/${i}.mp3`) //to know the length of the link
        // console.log(url[i].url)
      }
      //-----------------merge all audio files tol one-----------------------------------------------
      if (songs.length <= 1) {
        songLength = songs.length
        res.render(`${__dirname}/views/convert.ejs`, {
          ret: ret,
          songLength: songLength,
        }) //send response to user
      } else {
        songLength = songs.length
        audioconcat(songs)
          .concat('./public/audio/all.mp3')
          .on('start', function (command) {
            console.log('ffmpeg process started:', command)
          })
          .on('error', function (err, stdout, stderr) {
            console.error('Error:', err)
            console.error('ffmpeg stderr:', stderr)
          })
          .on('end', function (output) {
            console.error('Audio created in:', output)
          })
        res.render(`${__dirname}/views/convert.ejs`, {
          ret: ret,
          songLength: songLength,
        }) //send response to user
      }

      //--------send to frontend----------------------------------------
    })
  })

  //
  //
  //
})
//----------------------------------------------------------------
//----------------------------------------------------------------
app.listen(port, (err) => {
  if (!err) console.log('server started running on:' + port)
  else console.log('unable to start server')
})

const removeSongs = () => {
  fs.readdir(directory, (err, files) => {
    if (err) throw err

    for (const file of files) {
      fs.unlink(path.join(directory, file), (err) => {
        if (err) throw err
      })
    }
  })
}
