import React from 'react';
import { Link } from 'react-router-dom';
import ThemeToggle from '../components/ThemeToggle';
import LandingIllustration from '../assets/landing-illustration.png';

export default function Landing() {
  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground transition-colors duration-500">
      <header className="flex justify-end p-4">
        <ThemeToggle />
      </header>

      <main className="flex flex-1 items-center justify-center">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center px-6">
          <div className="mx-auto">
            <img
              src={LandingIllustration}
              alt="Landing Illustration"
              className="w-full max-w-md rounded-lg shadow-lg"
            />
          </div>

          <div className="space-y-6 text-center md:text-left">
            <h1 className="text-4xl font-bold">Welcome to NexxMSG</h1>
            <p className="text-lg text-muted-foreground">
              Connect with your friends and team in real time. Secure, fast, and fun!
            </p>
            <div className="flex justify-center md:justify-start space-x-4">
              <Link
                to="/register"
                className="px-6 py-3 bg-[coral] text-white rounded-full font-semibold hover:opacity-90 transition-opacity"
              >
                Sign Up
              </Link>
              <Link
                to="/login"
                className="px-6 py-3 bg-[coral] text-white rounded-full font-semibold hover:opacity-90 transition-opacity"
              >
                Log In
              </Link>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}