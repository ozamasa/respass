import * as session from 'express-session';
import * as passport from "passport";
import {Strategy as TwitterStrategy} from "passport-twitter";
import * as cors from "cors";

import {Message, User, TwitterIntegration, Connection} from "./models";
import {app} from "./app"

const {
  FRONTEND_URL,
  SESSION_SECRET,
  TWITTER_CONSUMER_KEY,
  TWITTER_CONSUMER_SECRET,
  TWITTER_CALLBACK_URL,
} = process.env;

app.use(cors({
  origin: FRONTEND_URL,
  credentials: true
}));
app.use(session({secret: SESSION_SECRET}));
app.use(passport.initialize());
app.use(passport.session());

passport.serializeUser((user, done) => {
  done(null, user.id)
});
passport.deserializeUser(async (id, done) => {
  try {
    done(null, await User.findById(id))
  } catch (e) {
    done(e, null);
  }
});

passport.use(new TwitterStrategy({
  consumerKey: TWITTER_CONSUMER_KEY,
  consumerSecret: TWITTER_CONSUMER_SECRET,
  callbackURL: TWITTER_CALLBACK_URL
}, async (token, secret, profile, done) => {
  try {
    const id = profile.id;
    let integration = await TwitterIntegration.findOne({where: {twitterId: id}});
    let user: User;
    if (integration) {
      user = await User.findById(integration.userId);
    } else {
      user = await User.create({name: profile.username});
      integration = await TwitterIntegration.create({twitterId: id, userId: user.id});
    }
    done(null, user);
  } catch (error) {
    done(error);
  }
}));

app.get("/auth/twitter", passport.authenticate("twitter"));
app.get("/auth/twitter/callback", passport.authenticate("twitter", {successRedirect: FRONTEND_URL, failureRedirect: FRONTEND_URL}));

app.get("/logout", (req, res) => {
  req.logout();
  res.redirect(FRONTEND_URL);
});