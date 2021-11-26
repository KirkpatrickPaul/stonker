const db = require('../models');

// define models for User Settings controller
module.exports = {
  findUser: function(req, res) {
    console.log('findUser');
    if (req.params.id) {
      db.user
        .findAll({
          include: [db.Comment],
          where: { id: req.params.id }
        })
        .then((dbModel) => {
          const { password, ...userData } = dbModel[0].dataValues;
          res.json([userData]);
        })
        .catch((err) => res.status(422).json(err));
    }
  }
};
