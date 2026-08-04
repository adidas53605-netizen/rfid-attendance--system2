const helpers = require('../utils/helpers');

const validateScanRequest = (req, res, next) => {
    const { rfid_uid } = req.body;
    if (!rfid_uid || !helpers.isValidRfidUid(rfid_uid)) {
        return res.status(400).json({ error: 'Invalid or missing rfid_uid' });
    }
    next();
};

const validateStudentData = (req, res, next) => {
    let { rfid_uid, name, roll_number, department } = req.body;
    
    if (!rfid_uid || !name || !roll_number || !department) {
        return res.status(400).json({ error: 'Missing required fields: rfid_uid, name, roll_number, department' });
    }

    req.body.rfid_uid = helpers.sanitize(rfid_uid);
    req.body.name = helpers.sanitize(name);
    req.body.roll_number = helpers.sanitize(roll_number);
    req.body.department = helpers.sanitize(department);

    next();
};

module.exports = {
    validateScanRequest,
    validateStudentData
};
