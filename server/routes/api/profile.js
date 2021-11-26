const router = require('express').Router();
const profileController = require('../../controllers/profileController');

router.route('/:id').get(profileController.findUser);

module.exports = router;
