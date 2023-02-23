
import express from 'express';
import { validationResult } from 'express-validator';
import { catchErrors } from '../lib/catch-errors.js';
import { isAlreadyRegistered, listEvent, listEvents, listRegistered, register, totalNumOfEvents, unRegister } from '../lib/db.js';
import {
  sanitizationMiddleware,
  xssSanitizationMiddleware
} from '../lib/validation.js';

export const indexRouter = express.Router();

async function indexRoute(req, res) {
  let { offset = 0, limit = 10 } = req.query;
  offset = Number(offset);
  limit = Number(limit);
  const events = await listEvents(offset, limit);
  const numOfEvents = await totalNumOfEvents();

  const result = {
    _links: {
      self: {
        href: `/?offset=${offset}&limit=${limit}`
      }
    },
    items: events
  }

  if (offset > 0) {
    result._links.prev = {
      href: `/?offset=${offset - limit}&limit=${limit}`,
    };
  }

  if (events.length <= limit && offset < events.length && numOfEvents.count > 10) {
    result._links.next = {
      href: `/?offset=${Number(offset) + limit}&limit=${limit}`,
    };
  }

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
    username,
    result
  });
}

async function eventRoute(req, res, next) {
  const { slug } = req.params;
  const event = await listEvent(slug);
  const loggedIn = req.isAuthenticated();

  let alreadyRegistered = false;
  if (loggedIn) {
    alreadyRegistered = await isAlreadyRegistered(req.user.name, event.id);
  }

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
    loggedIn,
    alreadyRegistered
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

async function unregisterRoute(req, res) {

  const { slug } = req.params;
  const event = await listEvent(slug);
  const { id } = event;
  const loggedIn = req.isAuthenticated();

  if (loggedIn) {
    await unRegister(req.user.name, id);
  }

  return res.redirect(`/${event.slug}`);
}

indexRouter.get('/', catchErrors(indexRoute));
indexRouter.get('/:slug/delete',
  catchErrors(unregisterRoute),
  );
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
