// migrations/[timestamp]-add-pdf-fields-to-account-info.js

'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('AccountInfos', 'pdfUrl', {
      type: Sequelize.STRING,
      allowNull: true
    });

    await queryInterface.addColumn('AccountInfos', 'pdfFileName', {
      type: Sequelize.STRING,
      allowNull: true
    });

    await queryInterface.addColumn('AccountInfos', 'pdfUploadDate', {
      type: Sequelize.DATE,
      allowNull: true,
      defaultValue: Sequelize.NOW
    });

    await queryInterface.addColumn('AccountInfos', 'pdfFileSize', {
      type: Sequelize.INTEGER,
      allowNull: true
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('AccountInfos', 'pdfUrl');
    await queryInterface.removeColumn('AccountInfos', 'pdfFileName');
    await queryInterface.removeColumn('AccountInfos', 'pdfUploadDate');
    await queryInterface.removeColumn('AccountInfos', 'pdfFileSize');
  }
};