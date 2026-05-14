import { DataTypes, Sequelize } from 'sequelize';

export default function model(sequelize: Sequelize) {
    const attributes = {
        token: { type: DataTypes.STRING },
        expires: { type: DataTypes.DATE },
        created: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
        createdByIp: { type: DataTypes.STRING },
        revoked: { type: DataTypes.DATE },
        revokedByIp: { type: DataTypes.STRING },
        replacedByToken: { type: DataTypes.STRING }
    };
    
    const options = { 
        timestamps: false 
    };
    
    const model = sequelize.define('refreshToken', attributes, options);
    
    // Add virtual fields after model creation
    (model.prototype as any).getIsExpired = function() {
        return Date.now() >= this.expires;
    };
    
    (model.prototype as any).getIsActive = function() {
        return !this.revoked && !this.getIsExpired();
    };
    
    return model;
}