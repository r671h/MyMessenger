import { Router, Response, Request } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import {prisma} from '../prismaClient';
import { AuthRequest, requireAuth } from '../middleware/auth';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET as string;

//REGISTER
router.post('/register', async (req:Request, res:Response) => {
    const {email, username, password} = req.body;
    if( !email || !username || !password) {
        return res.status(400).json({error: "Missing required fields"});
    }

    const existing = await prisma.user.findUnique({where: {email}});
    if(existing) {
        return res.status(409).json({error: "Email already exists"});
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
        data: { email, username, password : hashedPassword}
    });

    const token = jwt.sign({userId : user.id}, JWT_SECRET, { expiresIn: '7d'});

    res.cookie('token', token, {httpOnly: true, 
        sameSite: 'lax',
        secure: false,
        maxAge: 7 * 24 * 60 * 60 * 1000  
    });

    res.status(201).json({id: user.id, email: user.email, username: user.username})
})

router.post('/login', async (req:Request, res:Response)=> {
    const {email, password} = req.body;

    const user = await prisma.user.findUnique({where: {email}});
    if(!user){
        return res.status(401).json({error: "User was not found"});
    }

    const valid = await bcrypt.compare(password, user.password);
    if(!valid){
        return res.status(401).json({error: "Invalid credentials"});
    }

    const token = jwt.sign({userId : user.id}, JWT_SECRET, { expiresIn: '7d'});

    res.cookie('token', token, {
        httpOnly: true,
        sameSite: 'lax',
        secure: false,
        maxAge: 7 * 24 * 60 * 60 * 1000
    });

    res.json({ id: user.id, email: user.email, username: user.username });
})

router.get('/me', requireAuth, async (req: AuthRequest, res: Response) => {
    const user = await prisma.user.findUnique({
        where: {id: req.userId},
        select: {id:true, email:true, username:true, bio:true, avatarUrl:true}
    });

    if(!user){
        return res.status(404).json({error: "User not found"});
    }

    res.json(user);
});

router.post('/logout',(req:Request, res:Response) => {
    res.clearCookie('token')
    res.json({message: "Logged out successfully"})
});

export default router;