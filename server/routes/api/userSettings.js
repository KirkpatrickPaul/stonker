const router = require('express').Router();
const userSettingsController = require('../../controllers/userSettingsController');

router.route('/:id').get(topHitsController.findUser);

module.exports = router;
