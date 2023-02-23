import express from 'express';
import passport from '../lib/login.js';
import { createUser } from '../lib/users.js';

export const userRouter = express.Router();

function login(req, res) {
  if (req.isAuthenticated()) {
    return res.redirect('/');
  }

  let message = '';

  // Athugum hvort einhver skilaboð séu til í session, ef svo er birtum þau
  // og hreinsum skilaboð
  if (req.session.messages && req.session.messages.length > 0) {
    message = req.session.messages.join(', ');
    req.session.messages = [];
  }

  return res.render('login', { message, title: 'Innskráning' });
}

userRouter.get('/login', login);
userRouter.post(
  '/login',

  // Þetta notar strat að ofan til að skrá notanda inn
  passport.authenticate('local', {
    failureMessage: 'Notandanafn eða lykilorð vitlaust.',
    failureRedirect: '/login',
  }),

  // Ef við komumst hingað var notandi skráður inn, senda á /admin
  (req, res) => {
    res.redirect('/');
  }
);

userRouter.get('/logout', (req, res) => {
  // logout hendir session cookie og session
  // eslint-disable-next-line consistent-return
  req.logout((err) => {
    if (err) { return (err); }
    res.redirect('/');
  });
});

userRouter.get('/register', (req, res) => {
  res.render('register', { title: 'Nýskráning' });
});

userRouter.post('/register',
  async (req, res) => {
    const {name, username, password} = req.body;
    await createUser(name, username, password);
  res.redirect('/');
});
