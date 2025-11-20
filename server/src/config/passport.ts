
import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { Strategy as GitHubStrategy } from 'passport-github2';
import { Strategy as MicrosoftStrategy } from 'passport-microsoft';
import db from '../db';

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || 'placeholder_id';
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || 'placeholder_secret';
const GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID || 'placeholder_id';
const GITHUB_CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET || 'placeholder_secret';
const MICROSOFT_CLIENT_ID = process.env.MICROSOFT_CLIENT_ID || 'placeholder_id';
const MICROSOFT_CLIENT_SECRET = process.env.MICROSOFT_CLIENT_SECRET || 'placeholder_secret';


interface User {
    id: number | bigint;
    email: string;
    password?: string;
    google_id?: string;
    github_id?: string;
    microsoft_id?: string;
}

passport.serializeUser((user: any, done) => {
    done(null, user.id);
});

passport.deserializeUser((id: any, done) => {
    try {
        const stmt = db.prepare('SELECT * FROM users WHERE id = ?');
        const user = stmt.get(id) as User | undefined;
        done(null, user || null);
    } catch (err) {
        done(err, null);
    }
});

// Helper to find or create user
const findOrCreateUser = (profile: any, providerField: string, done: any) => {
    try {
        // 1. Try to find by provider ID
        let stmt = db.prepare(`SELECT * FROM users WHERE ${providerField} = ?`);
        let user = stmt.get(profile.id) as User | undefined;

        if (user) {
            return done(null, user);
        }

        // 2. Try to find by email (link accounts)
        const email = profile.emails?.[0]?.value;
        if (email) {
            stmt = db.prepare('SELECT * FROM users WHERE email = ?');
            user = stmt.get(email) as User | undefined;

            if (user) {
                // Link account
                const update = db.prepare(`UPDATE users SET ${providerField} = ? WHERE id = ?`);
                update.run(profile.id, user.id);
                return done(null, user);
            }
        }

        // 3. Create new user
        // For new OAuth users, we set a random password since they won't use it.
        const randomPassword = Math.random().toString(36).slice(-8);
        const insert = db.prepare(`INSERT INTO users (email, password, ${providerField}) VALUES (?, ?, ?)`);
        // If no email, use a placeholder or fail. Most providers give email.
        const userEmail = email || `${profile.id}@${providerField.split('_')[0]}.oauth`;

        const info = insert.run(userEmail, randomPassword, profile.id);
        const newUser: User = { id: info.lastInsertRowid, email: userEmail };
        done(null, newUser);

    } catch (err) {
        done(err, null);
    }
};

passport.use(new GoogleStrategy({
    clientID: GOOGLE_CLIENT_ID,
    clientSecret: GOOGLE_CLIENT_SECRET,
    callbackURL: "/api/auth/google/callback"
}, (accessToken, refreshToken, profile, done) => {
    findOrCreateUser(profile, 'google_id', done);
}));

passport.use(new GitHubStrategy({
    clientID: GITHUB_CLIENT_ID,
    clientSecret: GITHUB_CLIENT_SECRET,
    callbackURL: "/api/auth/github/callback"
}, (accessToken: string, refreshToken: string, profile: any, done: any) => {
    findOrCreateUser(profile, 'github_id', done);
}));

passport.use(new MicrosoftStrategy({
    clientID: MICROSOFT_CLIENT_ID,
    clientSecret: MICROSOFT_CLIENT_SECRET,
    callbackURL: "/api/auth/microsoft/callback",
    scope: ['user.read']
}, (accessToken: string, refreshToken: string, profile: any, done: any) => {
    // Microsoft strategy might return different profile structure
    const standardizedProfile = {
        id: profile.id,
        emails: profile.emails || (profile._json.mail ? [{ value: profile._json.mail }] : [])
    };
    findOrCreateUser(standardizedProfile, 'microsoft_id', done);
}));

export default passport;
