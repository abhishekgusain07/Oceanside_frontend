"use client";
import { useState, useEffect } from "react";
import { NavbarDemo } from "@/components/navbar";
import Pricing from "@/components/pricing";
import Image from "next/image";
import Link from "next/link";
import ProblemSection from "./components/problem";
import SolutionSection from "./components/solution";
import Footer from "./components/footer";
import TechnologyUsed from "./components/techused";
import Announcement from "./components/announcement";
import { HoverEffect } from "@/components/ui/card-hover-effect";
import type { LucideIcon } from "lucide-react";
import { useFeedbackModal } from "@/hooks/useFeedbackModal";
import { useUser } from "@/hooks/useUser";

export default function Home() {
  const [showAnnouncement, setShowAnnouncement] = useState(true);
  const { user } = useUser();
  const { openFeedbackModal, FeedbackModalComponent } = useFeedbackModal(user?.id);
  
  useEffect(() => {
    // Check if the announcement has been dismissed before
    const announcementDismissed = localStorage.getItem('announcement_dismissed');
    if (!announcementDismissed) {
      setShowAnnouncement(true);
    }
  }, []);
  
  const handleAnnouncementDismiss = () => {
    // Store the dismissal in localStorage so it stays dismissed on refresh
    localStorage.setItem('announcement_dismissed', 'true');
    setShowAnnouncement(false);
  };
  
  const announcement = {
    message: "We value your input! Please",
    link: {
      text: "share your feedback",
      url: "#feedback"
    },
    emoji: "💬"
  };

  // Handler for the announcement link click
  const handleFeedbackClick = (e: React.MouseEvent) => {
    e.preventDefault();
    openFeedbackModal();
  };

  const features: Array<{
    title: string;
    description: string;
    link: string;
    icon?: LucideIcon;
  }> = [
    {
      title: "Multi-Track Recording",
      description:
        "High-quality audio/video recording sessions with WebRTC peer-to-peer connections and real-time WebSocket signaling.",
      link: "/createsession",
    },
    {
      title: "Authentication",
      description:
        "Complete auth system with email, social login, magic links, and MFA support for secure user management.",
      link: "#auth",
    },
    {
      title: "Payments",
      description:
        "Stripe integration with subscription management, pricing tiers, and billing portal for smooth revenue collection.",
      link: "#payments",
    },
    {
      title: "Analytics",
      description:
        "Built-in analytics with PostHog and error tracking with Sentry to monitor user behavior and application health.",
      link: "#analytics",
    },
    {
      title: "Database",
      description:
        "Serverless PostgreSQL with Neon and Drizzle ORM for type-safe database operations with automatic scaling.",
      link: "#database",
    },
    {
      title: "UI Components",
      description:
        "Beautiful, accessible UI components built with Radix UI and styled with Tailwind CSS for rapid development.",
      link: "#ui",
    },
    {
      title: "Deployment",
      description:
        "Optimized for deployment on Vercel with continuous integration and automatic preview deployments.",
      link: "#deployment",
    },
  ];

  return (
    <div className="flex flex-col min-h-screen">
      <Announcement 
        show={showAnnouncement} 
        message={announcement.message}
        link={announcement.link}
        emoji={announcement.emoji}
        onDismiss={handleAnnouncementDismiss}
        onLinkClick={handleFeedbackClick}
      />
      <NavbarDemo>
        {/* Hero Section */}
        <section className="pt-8 pb-8 px-4 md:px-8 lg:px-16 flex flex-col items-center text-center">
          <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold tracking-tight mb-4 bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-blue-400 dark:from-blue-400 dark:to-blue-200 leading-tight">
            Ship Your SaaS <br />
            <span className="inline-block mt-1 mb-2">Blazingly Fast</span>
          </h1>
          <p className="text-lg text-muted-foreground max-w-xl mb-6">
            Everything you need, ready to launch.
          </p>
          <div className="flex flex-col sm:flex-row gap-4">
            <Link href="/dashboard" className="bg-primary text-primary-foreground hover:bg-primary/90 px-8 py-3 rounded-md font-medium text-lg shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30 transition-all">
              Get Started
            </Link>
          </div>
        </section>

        {/* Recording Platform Section */}
        <section className="py-16 px-4 md:px-8 lg:px-16 bg-gradient-to-br from-blue-50 to-indigo-100">
          <div className="max-w-4xl mx-auto text-center">
            <h2 className="text-4xl font-bold mb-6 text-gray-900">Multi-Track Recording Platform</h2>
            <p className="text-xl text-gray-600 mb-8 max-w-3xl mx-auto">
              Create high-quality recording sessions with real-time WebRTC connections. 
              Perfect for podcasts, interviews, and collaborative content creation.
            </p>
            <div className="grid md:grid-cols-3 gap-6 mb-10">
              <div className="bg-white p-6 rounded-lg shadow-md">
                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-4 mx-auto">
                  🎙️
                </div>
                <h3 className="text-lg font-semibold mb-2">High-Quality Audio</h3>
                <p className="text-gray-600 text-sm">Local recording ensures pristine audio quality, independent of network conditions</p>
              </div>
              <div className="bg-white p-6 rounded-lg shadow-md">
                <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mb-4 mx-auto">
                  🔗
                </div>
                <h3 className="text-lg font-semibold mb-2">Real-time Connection</h3>
                <p className="text-gray-600 text-sm">WebSocket signaling with WebRTC peer-to-peer for low-latency communication</p>
              </div>
              <div className="bg-white p-6 rounded-lg shadow-md">
                <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mb-4 mx-auto">
                  ☁️
                </div>
                <h3 className="text-lg font-semibold mb-2">Cloud Storage</h3>
                <p className="text-gray-600 text-sm">Automatic upload to cloud storage with chunk-based reliability</p>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/createsession" className="bg-blue-600 text-white hover:bg-blue-700 px-8 py-3 rounded-md font-medium text-lg shadow-lg transition-all">
                Create Recording Session
              </Link>
              <Link href="#features" className="border border-blue-600 text-blue-600 hover:bg-blue-50 px-8 py-3 rounded-md font-medium text-lg transition-all">
                Learn More
              </Link>
            </div>
          </div>
        </section>
        
        <TechnologyUsed />
        {/* Features Section */}
        <section id="features" className="py-16 px-4 md:px-8 lg:px-16 bg-secondary/20">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-3xl font-bold text-center mb-16">Everything You Need</h2>
            <HoverEffect items={features} />
          </div>
        </section>


        <ProblemSection />

        <SolutionSection />
        {/* Pricing Section */}
        <section className="py-16 px-4 md:px-8 lg:px-16">
          <Pricing />
        </section>

        {/* CTA Section */}
        <section className="py-16 px-4 md:px-8 lg:px-16 bg-primary/5">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-3xl font-bold mb-6">Ready to Get Started?</h2>
            <p className="text-xl text-muted-foreground mb-8">
              Launch your SaaS in record time with our production-ready template.
            </p>
            <Link href="/sign-up" className="bg-primary text-primary-foreground hover:bg-primary/90 px-8 py-3 rounded-md font-medium inline-block">
              Start Building Now
            </Link>
          </div>
        </section>
        <Footer />
      </NavbarDemo>
      
      {/* Render the feedback modal */}
      <FeedbackModalComponent />
    </div>
  );
}
