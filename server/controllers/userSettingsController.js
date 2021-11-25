const db = require('../models');

// define models for User Settings controller
module.exports = {
  findUser: function(req, res) {
    if (req.params.id) {
      db.user
        .findAll({
          include: [db.Comment],
          where: { id: req.params.id }
        })
        .then((dbModel) => {
          console.log(dbModel);
          res.json(dbModel);
        })
        .catch((err) => res.status(422).json(err));
    }
  }
};
