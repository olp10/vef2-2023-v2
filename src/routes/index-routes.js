import express from 'express';
import { validationResult } from 'express-validator';
import { catchErrors } from '../lib/catch-errors.js';
import { listEvent, listEvents, listRegistered, register } from '../lib/db.js';
import {
  sanitizationMiddleware,
  xssSanitizationMiddleware
} from '../lib/validation.js';

export const indexRouter = express.Router();

async function indexRoute(req, res) {
  const events = await listEvents();
  const loggedIn = req.isAuthenticated();
  let username;
  let admin;

  if (loggedIn) {
    username = req.user.username;
    admin = req.user.admin;
  }


  res.render('index', {
    title: 'Viðburðasíðan',
    admin,
    events,
    loggedIn,
    username
  });
}

async function eventRoute(req, res, next) {
  const { slug } = req.params;
  const event = await listEvent(slug);
  const loggedIn = req.isAuthenticated();

  if (!event) {
    return next();
  }

  const registered = await listRegistered(event.id);

  return res.render('event', {
    title: `${event.name} — Viðburðasíðan`,
    event,
    registered,
    errors: [],
    data: {},
    loggedIn
  });
}

async function eventRegisteredRoute(req, res) {
  const events = await listEvents();

  res.render('registered', {
    title: 'Viðburðasíðan',
    events,
  });
}

async function validationCheck(req, res, next) {
  const { name, comment } = req.body;

  // TODO tvítekning frá því að ofan
  const { slug } = req.params;
  const event = await listEvent(slug);
  const registered = await listRegistered(event.id);
  const loggedIn = req.isAuthenticated();

  const data = {
    name,
    comment,
  };

  const validation = validationResult(req);

  if (!validation.isEmpty()) {
    return res.render('event', {
      title: `${event.name} — Viðburðasíðan`,
      data,
      event,
      registered,
      errors: validation.errors,
      loggedIn
    });
  }

  return next();
}

async function registerRoute(req, res) {
  const { name } = req.user;
  const { comment } = req.body;
  const { slug } = req.params;
  const event = await listEvent(slug);
  const loggedIn = req.isAuthenticated();

  const registered = await register({
    name,
    comment,
    event: event.id,
    loggedIn
  });

  if (registered) {
    return res.redirect(`/${event.slug}`);
  }

  return res.render('error');
}

indexRouter.get('/', catchErrors(indexRoute));
indexRouter.get('/:slug', catchErrors(eventRoute));
indexRouter.post(
  '/:slug',
  // registrationValidationMiddleware('comment'),
  xssSanitizationMiddleware('comment'),
  catchErrors(validationCheck),
  sanitizationMiddleware('comment'),
  catchErrors(registerRoute)
);
indexRouter.get('/:slug/thanks', catchErrors(eventRegisteredRoute));
