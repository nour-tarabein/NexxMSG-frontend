// src/pages/LandingPage.jsx
import React from 'react';
import { Link } from 'react-router-dom';
import { MessageCircle, Shield, Zap, Users, Star, ArrowRight } from 'lucide-react';
import ThemeToggle from '../components/ThemeToggle';

export default function Landing() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 dark:from-slate-900 dark:to-slate-800 text-foreground transition-colors duration-500">
      {/* Header */}
      <header className="flex justify-between items-center p-6 max-w-7xl mx-auto">
        <div className="flex items-center gap-2">
          <MessageCircle className="h-8 w-8 text-orange-500" />
          <span className="text-2xl font-bold">NexxMSG</span>
        </div>
        <div className="flex items-center gap-4">
          <ThemeToggle />
          <Link 
            to="/login" 
            className="text-orange-500 hover:text-orange-600 font-medium transition-colors"
          >
            Sign In
          </Link>
        </div>
      </header>

      {/* Hero Section */}
      <main className="max-w-7xl mx-auto px-6 py-16">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          {/* Left Content */}
          <div className="space-y-8">
            <div className="space-y-4">
              <h1 className="text-5xl lg:text-6xl font-bold leading-tight">
                Connect
                <span className="block text-orange-500 relative">
                  conversations
                  <div className="absolute -bottom-2 left-0 w-full h-1 bg-orange-500 rounded-full opacity-60"></div>
                </span>
              </h1>
              <p className="text-xl text-muted-foreground leading-relaxed max-w-lg">
                Fast, secure and engaging - turn messaging into meaningful connections with end-to-end encryption and real-time communication.
              </p>
            </div>

            {/* CTA Section */}
            <div className="space-y-4">
              <div className="flex gap-4">
                <input
                  type="email"
                  placeholder="Enter your email"
                  className="flex-1 px-4 py-3 rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
                <Link
                  to="/register"
                  className="px-8 py-3 bg-orange-500 hover:bg-orange-600 text-white rounded-xl font-semibold transition-colors flex items-center gap-2"
                >
                  Get Started
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
              <p className="text-sm text-muted-foreground">
                Already have an account? 
                <Link to="/login" className="text-orange-500 hover:text-orange-600 ml-1 font-medium">
                  Sign in here
                </Link>
              </p>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-1 gap-8 pt-8">
              <div>
                <div className="text-3xl font-bold text-foreground">99.9%</div>
                <div className="text-sm text-muted-foreground">Message delivery rate</div>
              </div>
            </div>
          </div>

          {/* Right Illustration */}
          <div className="relative">
            <div className="relative z-10">
              {/* Main Chat Interface Mockup */}
              <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl p-6 transform rotate-3 hover:rotate-1 transition-transform duration-300">
                <div className="flex items-center gap-3 mb-4 p-3 bg-slate-50 dark:bg-slate-700 rounded-xl">
                  <div className="w-10 h-10 bg-orange-500 rounded-full flex items-center justify-center">
                    <span className="text-white font-bold">A</span>
                  </div>
                  <div>
                    <div className="font-semibold">Alex Johnson</div>
                    <div className="text-sm text-green-500 flex items-center gap-1">
                      <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                      Online
                    </div>
                  </div>
                </div>
                
                <div className="space-y-3">
                  <div className="flex justify-end">
                    <div className="bg-orange-500 text-white px-4 py-2 rounded-2xl rounded-br-md max-w-xs">
                      Hey! How's the new messaging app working?
                    </div>
                  </div>
                  <div className="flex justify-start">
                    <div className="bg-slate-100 dark:bg-slate-600 px-4 py-2 rounded-2xl rounded-bl-md max-w-xs">
                      It's amazing! Super fast and secure 🔒
                    </div>
                  </div>
                  <div className="flex justify-end">
                    <div className="bg-orange-500 text-white px-4 py-2 rounded-2xl rounded-br-md max-w-xs">
                      Love the end-to-end encryption!
                    </div>
                  </div>
                </div>
              </div>

              {/* Floating Feature Cards */}
              <div className="absolute -top-4 -left-4 bg-white dark:bg-slate-800 rounded-xl shadow-lg p-4 transform -rotate-12 hover:rotate-0 transition-transform duration-300">
                <Shield className="h-6 w-6 text-green-500 mb-2" />
                <div className="text-sm font-semibold">End-to-End</div>
                <div className="text-sm text-muted-foreground">Encrypted</div>
              </div>

              <div className="absolute -bottom-4 -right-4 bg-white dark:bg-slate-800 rounded-xl shadow-lg p-4 transform rotate-12 hover:rotate-0 transition-transform duration-300">
                <Zap className="h-6 w-6 text-yellow-500 mb-2" />
                <div className="text-sm font-semibold">Lightning</div>
                <div className="text-sm text-muted-foreground">Fast</div>
              </div>

              <div className="absolute top-1/2 -right-8 bg-white dark:bg-slate-800 rounded-xl shadow-lg p-4 transform rotate-6 hover:rotate-0 transition-transform duration-300">
                <Users className="h-6 w-6 text-blue-500 mb-2" />
                <div className="text-sm font-semibold">Group</div>
                <div className="text-sm text-muted-foreground">Chats</div>
              </div>
            </div>

            {/* Background Decoration */}
            <div className="absolute inset-0 bg-gradient-to-r from-orange-400/20 to-blue-400/20 rounded-3xl blur-3xl -z-10 transform scale-110"></div>
          </div>
        </div>

        {/* Features Section */}
        <section id="features" className="mt-32">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-4">Why choose NexxMSG?</h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Built for modern communication with security and simplicity at its core
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="text-center p-8 rounded-2xl bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm border border-border hover:shadow-lg transition-shadow">
              <Shield className="h-12 w-12 text-green-500 mx-auto mb-4" />
              <h3 className="text-xl font-semibold mb-2">End-to-End Encryption</h3>
              <p className="text-muted-foreground">Your messages are secured with military-grade encryption. Only you and your recipient can read them.</p>
            </div>

            <div className="text-center p-8 rounded-2xl bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm border border-border hover:shadow-lg transition-shadow">
              <Zap className="h-12 w-12 text-yellow-500 mx-auto mb-4" />
              <h3 className="text-xl font-semibold mb-2">Lightning Fast</h3>
              <p className="text-muted-foreground">Real-time messaging with instant delivery. Experience seamless communication without delays.</p>
            </div>

            <div className="text-center p-8 rounded-2xl bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm border border-border hover:shadow-lg transition-shadow">
              <Users className="h-12 w-12 text-blue-500 mx-auto mb-4" />
              <h3 className="text-xl font-semibold mb-2">Group Conversations</h3>
              <p className="text-muted-foreground">Create groups, share moments, and stay connected with multiple friends and colleagues at once.</p>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}