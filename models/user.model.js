const { DataTypes } = require('sequelize')
const bcrypt = require('bcrypt')

module.exports = (sequelize) => {
  // eslint-disable-next-line no-undef
  User = sequelize.define(
    'User',
    {
      userID: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
      },
      email: {
        type: DataTypes.STRING,
        allowedNull: false,
        unique: true
      },
      password: {
        type: DataTypes.STRING,
        allowedNull: false
      },
    },
  )
  return User
}
