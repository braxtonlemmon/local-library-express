const { body, validationResult } = require('express-validator/check');
const Book = require('../models/book');
const Author = require('../models/author');
const Genre = require('../models/genre');
const BookInstance = require('../models/bookinstance');

const async = require('async');

exports.index = function(req, res) {
  async.parallel({
    book_count: function(callback) {
      Book.countDocuments({}, callback);
    },
    book_instance_count: function(callback) {
      BookInstance.countDocuments({}, callback);
    },
    book_instance_available_count: function(callback) {
      BookInstance.count({status:'Available'}, callback);
    },
    author_count: function(callback) {
      Author.countDocuments({}, callback);
    },
    genre_count: function(callback) {
      Genre.countDocuments({}, callback);
    }
  }, function(err, results) {
    res.render('index', { title: 'Local Library Home', error: err, data: results });
  });
}

// Display list of all books.
exports.book_list = function(req, res, next) {
  Book.find({}, 'title author')
    .populate('author')
    .exec(function (err, list_books) {
      if (err) { return next(err) }
      res.render('book_list', { title: 'Book List', book_list: list_books });
    });
};

// Display detail page for a specific book.
exports.book_detail = function (req, res) {
  res.send('NOT IMPLEMENTED: Book detail: ' + req.params.id);
};

exports.book_detail = function (req, res, next) {
  async.parallel({
    book: function(callback) {
      Book.findById(req.params.id)
      .populate('author')
      .populate('genre')
      .exec(callback)
    },
    book_instance: function(callback) {
      BookInstance.find({ 'book': req.params.id })
      .exec(callback)
    },
  }, function(err, results) {
    if (err) { return next(err) }
    if (results.book === null) {
      const err = new Error('Book not found');
      err.status = 404;
      return next(err);
    }
    res.render('book_detail', { title: results.book.title, book: results.book, book_instances: results.book_instance });
  });
};

// Display book create form on GET.
exports.book_create_get = function (req, res, next) {
  async.parallel({
    authors: function(callback) {
      Author.find(callback);
    },
    genres: function(callback) {
      Genre.find(callback);
    },
  }, function(err, results) {
    if (err) { return next(err) }
    res.render('book_form', { title: 'Create Book', authors: results.authors, genres: results.genres });
  });
};

// Handle book create on POST.
exports.book_create_post = [
  (req, res, next) => {
    if (!(req.body.genre instanceof Array)) {
      if (typeof req.body.genre === 'undefined') {
        req.body.genre = [];
      } else {
        req.body.genre = new Array(req.body.genre);
      }
    }
    next();
  },

  body('title', 'Title must not be empty.').trim().isLength({ min: 1 }),
  body('author', 'Author must not be empty.').trim().isLength({ min: 1 }),
  body('summary', 'Summary must not be empty.').trim().isLength({ min: 1 }),
  body('isbn', 'ISBN must not be empty').trim().isLength({ min: 1 }),

  body('*').escape(),

  (req, res, next) => {
    const errors = validationResult(req);
    const book = new Book(
      {
        title: req.body.title,
        author: req.body.author,
        summary: req.body.summary,
        isbn: req.body.isbn,
        genre: req.body.genre
      }
    );
    if (!errors.isEmpty()) {
      async.parallel({
        authors: function(callback) {
          Author.find(callback);
        },
        genres: function(callback) {
          Genre.find(callback);
        },
      }, function(err, results) {
        if (err) { return next(err) }
        for (let i = 0; i < results.genres.length; i++) {
          if (book.genre.indexOf(results.genres[i]._id) > -1) {
            results.genres[i].checked = 'true';
          }
        }
        res.render('book_form', { title: 'Create Book', authors: results.authors, genres: results.genres, book: book, errors: errors.array() });
      });
      return;
    }
    else {
      book.save(function (err) {
        if (err) { return next(err) }
        res.redirect(book.url);
      });
    }
  }
];

// Display book delete form on GET.
exports.book_delete_get = function(req, res, next) {
  async.parallel({
    book: function(callback) {
      Book.findById(req.params.id).exec(callback)
    },
    books_instances: function(callback) {
      BookInstance.find({ 'book': req.params.id }).exec(callback)
    },
  }, function(err, results) {
    if (err) { return next(err) }
    if (results.book === null) {
      res.redirect('/catalog/books');
    }
    res.render('book_delete', { title: 'Delete Book', book: results.book, book_instances: results.books_instances });
  });
};

// Handle book delete on POST.
exports.book_delete_post = function (req, res, next) {
  async.parallel({
    book: function (callback) {
      Book.findById(req.body.bookid).exec(callback)
    },
    books_instances: function (callback) {
      BookInstance.find({ 'book': req.body.bookid }).exec(callback)
    },
  }, function(err, results) {
    if (err) { return next(err) }
    if (results.books_instances.length > 0) {
      res.render('book_delete', { title: 'Delete Book', book: results.book, book_instances: results.books_instances });
      return;
    }
    else {
      Book.findByIdAndRemove(req.body.bookid, function deleteBook(err) {
        if (err) { return next(err) }
        res.redirect('/catalog/books')
      });
    }
  });
};




// Display book update form on GET.
exports.book_update_get = function (req, res, next) {
  async.parallel({
    book: function(callback) {
      Book.findById(req.params.id).populate('author').populate('genre').exec(callback);
    },
    authors: function(callback) {
      Author.find(callback);
    },
    genres: function(callback) {
      Genre.find(callback);
    },
  }, function(err, results) {
    if (err) { return next(err) }
    if (results.book === null) {
      const err = new Error('Book not found');
      err.status = 404;
      return next(err);
    }
    for (let all_g_iter = 0; all_g_iter < results.genres.length; all_g_iter++) {
      for (let book_g_iter = 0; book_g_iter < results.book.genre.length; book_g_iter++) {
        if (results.genres[all_g_iter]._id.toString() === results.book.genre[book_g_iter]._id.toString()) {
          results.genres[all_g_iter].checked = 'true';
        }
      }
    }
    res.render('book_form', { title: 'Update Book', authors: results.authors, genres: results.genres, book: results.book });
  })
}

// Handle book update on POST.
exports.book_update_post = [
  (req, res, next) => {
    if (!(req.body.genre instanceof Array)) {
      if (typeof req.body.genre === 'undefined')
        req.body.genre = [];
      else
        req.body.genre = new Array(req.body.genre);
    }
    next();
  },

  body('title', 'Title must not be empty.').trim().isLength({ min: 1 }),
  body('author', 'Author must not be empty.').trim().isLength({ min: 1 }),
  body('summary', 'Summary must not be empty.').trim().isLength({ min: 1 }),
  body('isbn', 'ISBN must not be empty').trim().isLength({ min: 1 }),

  body('title').escape(),
  body('author').escape(),
  body('summary').escape(),
  body('isbn').escape(),
  body('genre.*').escape(),

  (req, res, next) => {
    const errors = validationResult(req);
    const book = new Book(
      {
        title: req.body.title,
        author: req.body.author,
        summary: req.body.summary,
        isbn: req.body.isbn,
        genre: (typeof req.body.genre === 'undefined') ? [] : req.body.genre,
        _id: req.params.id
      }
    );
    if (!errors.isEmpty()) {
      async.parallel({
        authors: function(callback) {
          Author.find(callback);
        },
        genres: function(callback) {
          Genre.find(callback);
        },
      }, function(err, results) {
        if (err) { return next(err) }
        for (let i = 0; i < results.genres.length; i++) {
          if (book.genre.indexOf(results.genres[i]._id) > -1) {
            results.genres[i].checked = 'true';
          }
        }
        res.render('book_form', { title: 'Update Book', authors: results.authors, genres: results.genres, book: book, errors: errors.array() });
      });
      return;
    }
    else {
      Book.findByIdAndUpdate(req.params.id, book, {}, function (err, thebook) {
        if (err) {return next(err) }
        res.redirect(thebook.url);
      });
    }
  }
];