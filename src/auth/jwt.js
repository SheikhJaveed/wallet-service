const jwt=require('jsonwebtoken');

const SECRET=process.env.JWT_SECRET || 'dev-secret';

function signToken({user_id,account_id,role}){
    return jwt.sign({
        sub: user_id,
        account_id,
        role
    },
    SECRET,{
        expiresIn: '7d'
    })
}

function verifyToken(token){
    return jwt.verify(token,SECRET);
}

module.exports={signToken,verifyToken};