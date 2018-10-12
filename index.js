#!/usr/bin/env node

const express = require('express')
const request = require('request')
const querystring = require('querystring')
const bodyParser = require('body-parser')
const cookieParser = require('cookie-parser')
const cors = require('cors')

require('dotenv').load()

const clientId = process.env.CLIENT_ID
const clientSecret = process.env.CLIENT_SECRET
const returnUrl = process.env.RETURN_URL
const scopes = process.env.SCOPES

const stateKey = 'spotify_auth_state'

const app = express()
app.use(bodyParser.json())
app.use(cookieParser())
app.use(cors())

app.get('/spotify-auth/login', (req, res) => {
  let state = generateRandomString(16)
  res.cookie(stateKey, state)

  res.redirect('https://accounts.spotify.com/authorize?' +
    querystring.stringify({
      response_type: 'code',
      client_id: clientId,
      scope: scopes,
      redirect_uri: returnUrl,
      state: state
  }))
})

app.get('/spotify-auth/refresh', (req, res) => {
  const refreshToken = req.query.refreshToken || null

  if (refreshToken === null) {
    res.status(400)
    res.json({
      code: 'refresh_token_required'
    })
  } else {
    const authOptions = {
      url: 'https://accounts.spotify.com/api/token',
      form: {
        grant_type: 'refresh_token',
        refresh_token: refreshToken
      },
      headers: {
        'Authorization': 'Basic ' + (new Buffer(clientId + ':' + clientSecret).toString('base64'))
      },
      json: true
    }

    request.post(authOptions, (error, response, body) => {
      if (!error && res.statusCode === 200) {
        const accessToken = body.access_token
        const expiresIn = body.expires_in

        res.status(200)
        res.json({
          accessToken: accessToken,
          expiresIn: expiresIn
        })
      } else {
        res.status(500)
        res.json({
          code: 'spotify_communication_error'
        })
      }
    })
  }
})

app.get('/spotify-auth/callback', (req, res) => {
  const code = req.query.code || null
  const state = req.query.state || null
  const storedState = req.cookies ? req.cookies[stateKey] : null

  if (state === null || state !== storedState) {
    res.status(403)
    res.json({
      code: 'state_mismatch'
    })
  } else {
    res.clearCookie(stateKey)

    const authOptions = {
      url: 'https://accounts.spotify.com/api/token',
      form: {
        code: code,
        redirect_uri: returnUrl,
        grant_type: 'authorization_code'
      },
      headers: {
        'Authorization': 'Basic ' + (new Buffer(clientId + ':' + clientSecret).toString('base64'))
      },
      json: true
    }

    request.post(authOptions, (error, response, body) => {
      if (!error && res.statusCode === 200) {
        const accessToken = body.access_token
        const refreshToken = body.refresh_token
        const expiresIn = body.expires_in

        res.status(200)
        res.json({
          accessToken: accessToken,
          refreshToken: refreshToken,
          expiresIn: expiresIn
        })
      } else {
        res.status(500)
        res.json({
          code: 'spotify_communication_error'
        })
      }
    })
  }
})

app.listen(process.env.PORT)

const generateRandomString = (length) => {
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  let text = ''

  for (let i = 0; i < length; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length))
  }
  return text
}
