const SkillListing = require('../models/SkillListing');

exports.createSkill = async (req, res) => {
  try {
    const skill = new SkillListing({ ...req.body, user: req.userId || req.user._id });
    await skill.save();
    res.status(201).json(skill);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

exports.getSkills = async (req, res) => {
  try {
    const { q, location, tag } = req.query;
    const filter = {};
    if (q) filter.skillName = new RegExp(q, 'i');
    if (location) filter.location = location;
    if (tag) filter.tags = tag;
    // Populate user profile for each skill
    const skills = await SkillListing.find(filter)
      .sort({ createdAt: -1 })
      .populate({
        path: 'user',
        select: 'name email avatar paymentSettings',
      });

    // Map skills to include mentor session rates from user profile
    const mappedSkills = skills.map(skill => {
      let sessionRates = { thirtyMin: 0, sixtyMin: 0, ninetyMin: 0 };
      let stripeEnabled = false;
      let currency = 'USD';
      if (skill.user && skill.user.paymentSettings && skill.user.paymentSettings.paymentSettings) {
        sessionRates = skill.user.paymentSettings.paymentSettings.pricing || sessionRates;
        stripeEnabled = skill.user.paymentSettings.paymentSettings.stripeEnabled || false;
        currency = skill.user.paymentSettings.paymentSettings.currency || 'USD';
      }
      return {
        ...skill.toObject(),
        mentor: {
          id: skill.user._id,
          name: skill.user.name,
          email: skill.user.email,
          avatar: skill.user.avatar,
          sessionRates,
          stripeEnabled,
          currency
        }
      };
    });
    res.json(mappedSkills);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

exports.updateSkill = async (req, res) => {
  try {
    const skill = await SkillListing.findOneAndUpdate({ _id: req.params.id, user: req.userId || req.user._id }, req.body, { new: true });
    if (!skill) return res.status(404).json({ error: 'Skill not found' });
    res.json(skill);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

exports.deleteSkill = async (req, res) => {
  try {
    const skill = await SkillListing.findOneAndDelete({ _id: req.params.id, user: req.userId || req.user._id });
    if (!skill) return res.status(404).json({ error: 'Skill not found' });
    res.json({ message: 'Skill deleted' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}; 