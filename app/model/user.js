let mongoose = require("mongoose");
let bcrypt = require("bcrypt");

var userSchema = mongoose.Schema({
  email: String,
  gid: String,
  password: String,
  name: String,
});

userSchema.methods.generateHash = function (password) {
  return bcrypt.hashSync(password, bcrypt.genSaltSync(8), null);
};

userSchema.methods.validation = function (password) {
  return bcrypt.compareSync(password, this.password);
};

module.exports = mongoose.model("User", userSchema);
