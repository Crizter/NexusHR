import {Strategy, ExtractJwt} from 'passport-jwt' ; 
import User from '../models/User.models.js';


const options = { 
    jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
    secretOrKey: process.env.JWT_SECRET,
} ;

export default function configurePassport(passport){
    passport.use(
        new Strategy(options,async(jwt_payload,done)=>{
            try {
                const user = await User.findById(jwt_payload.id);
                if(user && !user.isDeleted){
                    return done(null,user) ; 
                } 
                return done(null,false) ; 
            } catch (error) {
                return done(error,false) ; 
            }
        })
    )
} ; 
