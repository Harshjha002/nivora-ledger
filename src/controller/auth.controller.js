const User = require("../models/user.model")
const jwt = require("jsonwebtoken")


/** 
* - User Register controller 
* - POST /v1/api/auth/register
*/
const userRegisterController = async (req,res) => {

    const {email , name , password} = req.body

    const isExists = await User.findOne({
        email:email
    })

    if(isExists){
        return res.status(422).json({
            message:"User alredy exist with this email",
            status:"failed"
        })
    }

    const user = await User.create({
        email,password , name
    })

    const token = jwt.sign({userID:user._id},process.env.JWT_SECRET,{expiresIn:"3d"})

    res.cookie("token", token)

    res.status(201).json({
        user:{
            _id:user._id,
            email:user.email,
            name:user.name
        },
        token
    })



}

/** 
* - User Login controller 
* - POST /v1/api/auth/login
*/
const  userLoginController = async (req,res) => {
    const {email,password} = req.body;


    const user = await User.findOne({ email }).select("+password");

    if(!user){
        return res.status(401).json({
            message:"Email or password is invalid"
        })
    }

   const isValidPassword = await user.comparePassword(password)

   if(!isValidPassword){
     return res.status(401).json({
            message:"Email or password is invalid"
        })
   }

    const token = jwt.sign({userID:user._id},process.env.JWT_SECRET,{expiresIn:"3d"})

    res.cookie("token", token)

    res.status(200).json({
        user:{
            _id:user._id,
            email:user.email,
            name:user.name
        },
        token
    })
}

module.exports = {
    userRegisterController,userLoginController
}

