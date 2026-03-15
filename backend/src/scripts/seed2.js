import dotenv from 'dotenv';
import mongoose from 'mongoose' ; 
import Users from './models/User.models.js'
import Organization from './models/Organization.models.js';
import bcrypt from "bcryptjs";
import connectDB from './config/db.js';
import 'dotenv/config'


const orgData = { 
    name: 'NEXUS-HQ',
    slug: 'nexus-hq',
    subscription:{
        plan:'enterprise'
    }, 
    maxUsers: 100,
    settings:
    {
        casualLeaves: 15,
        sickLeaves: 15,
    }, 
    payroll: { 
        currency: 'USD',
        payCycle: 'monthly', 
        taxId: 'EMP-123456789',
    },
} ; 

const seedDatabase = async() => { 
     try {
        await connectDB();
        const org = await Organization.create(orgData) ; 
        console.log('org created');
        // create the user 
        const passwordHash = await bcrypt.hash('password123',10) ; 

         await Users.create({
            orgId: org._id, 
            email: "superAdmin@nexusHr.com",
            passwordHash,
            role: "super_admin",
            profile:{
                firstName: 'super',
                lastName: 'admin',
                contactNumber: '123456789',                
            },
        }) ; 
        console.log('super admin created') ; 
        process.exit(0) ; 

    } catch (error) {
        console.error('failed to created',error) ; 
        process.exit(1) ; 
    }

}

seedDatabase();