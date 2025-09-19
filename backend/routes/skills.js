const express = require('express');
const router = express.Router();
const { createSkill, getSkills, updateSkill, deleteSkill } = require('../controllers/skillController');
const { requireAuth } = require('../middleware/auth');

router.post('/', requireAuth, createSkill);
router.get('/', getSkills);
router.put('/:id', requireAuth, updateSkill);
router.delete('/:id', requireAuth, deleteSkill);

module.exports = router; 