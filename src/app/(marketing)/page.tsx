"use client";

import { useState } from "react";
import Link from "next/link";
import {
  BookOpen,
  Search,
  Brain,
  Share2,
  Lightbulb,
  FileText,
  FolderSync,
  Server,
  Users,
  Cpu,
  ArrowRight,
  CheckCircle2,
  Loader2,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

const features = [
  {
    icon: Search,
    title: "Multi-Source Discovery",
    description:
      "Search across Semantic Scholar, arXiv, PubMed, OpenAlex, and CrossRef from a single interface. No more switching between databases.",
  },
  {
    icon: Brain,
    title: "AI-Powered Analysis",
    description:
      "Automatically generate paper summaries, extract key findings, identify methodologies, and surface research gaps using your institution's LLM.",
  },
  {
    icon: Share2,
    title: "Citation Graph Visualization",
    description:
      "Map citation networks interactively. Trace influence paths, discover clusters, and identify seminal papers at a glance.",
  },
  {
    icon: Lightbulb,
    title: "Knowledge Extraction",
    description:
      "Automatically categorize findings, methods, contributions, limitations, and future work across your entire paper library.",
  },
  {
    icon: FileText,
    title: "PDF Management",
    description:
      "Upload, parse, and annotate PDFs directly. Full-text extraction means every paper is searchable and analyzable.",
  },
  {
    icon: FolderSync,
    title: "Synthesis & Export",
    description:
      "Organize papers into collections, generate cross-paper syntheses, and export everything as portable static sites.",
  },
];

const valueProps = [
  {
    icon: Server,
    title: "Deploy On Your Infrastructure",
    description:
      "Full data sovereignty. Self-host on-prem or deploy to your institution's cloud. Research data never leaves your control.",
  },
  {
    icon: Users,
    title: "Scale Across Departments",
    description:
      "One deployment serves every lab, department, and research group. No per-seat licensing. No usage caps.",
  },
  {
    icon: Cpu,
    title: "LLM-Agnostic Architecture",
    description:
      "Works with any OpenAI-compatible endpoint — local models, commercial APIs, or your institution's private LLM infrastructure.",
  },
];

const stats = [
  { value: "5", label: "Integrated Data Sources" },
  { value: "Real-time", label: "AI Analysis" },
  { value: "Zero", label: "Vendor Lock-in" },
  { value: "100%", label: "Self-Hosted" },
];

const roles = [
  "Faculty / Researcher",
  "Department Head",
  "Library Director",
  "IT / Infrastructure",
  "Research Administrator",
  "Other",
];

export default function LandingPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <SiteNav />
      <HeroSection />
      <TrustedBySection />
      <FeaturesSection />
      <ValuePropsSection />
      <StatsSection />
      <DemoRequestSection />
      <SiteFooter />
    </div>
  );
}

function SiteNav() {
  return (
    <header className="sticky top-0 z-50 border-b border-zinc-800/50 bg-zinc-950/80 backdrop-blur-xl">
      <div className="mx-auto max-w-6xl flex items-center justify-between px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 shadow-lg shadow-emerald-500/20">
            <BookOpen className="h-5 w-5 text-white" />
          </div>
          <span className="text-lg font-bold tracking-tight">Tessera</span>
        </div>
        <div className="flex items-center gap-4">
          <Link
            href="/dashboard"
            className="text-sm text-zinc-400 hover:text-zinc-100 transition-colors hidden sm:block"
          >
            Open App
          </Link>
          <Button asChild size="sm" className="bg-emerald-600 hover:bg-emerald-500 text-white">
            <a href="#demo">Request a Demo</a>
          </Button>
        </div>
      </div>
    </header>
  );
}

function HeroSection() {
  return (
    <section className="relative overflow-hidden">
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-b from-emerald-950/20 via-zinc-950 to-zinc-950" />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-emerald-500/5 rounded-full blur-3xl" />

      <div className="relative mx-auto max-w-4xl px-6 pt-24 pb-20 text-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-4 py-1.5 text-sm text-emerald-400 mb-8">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
          Now available for institutional deployment
        </div>

        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight leading-[1.1]">
          AI-Powered Literature Review{" "}
          <span className="bg-gradient-to-r from-emerald-400 to-teal-400 bg-clip-text text-transparent">
            for Your Institution
          </span>
        </h1>

        <p className="mt-6 text-lg sm:text-xl text-zinc-400 max-w-2xl mx-auto leading-relaxed">
          Accelerate research output across every department with intelligent paper
          discovery, automated analysis, and knowledge synthesis.
        </p>

        <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
          <Button asChild size="lg" className="bg-emerald-600 hover:bg-emerald-500 text-white px-8 h-12 text-base">
            <a href="#demo">
              Request a Demo
              <ArrowRight className="ml-2 h-4 w-4" />
            </a>
          </Button>
          <Button asChild variant="outline" size="lg" className="border-zinc-700 hover:bg-zinc-800 px-8 h-12 text-base">
            <a href="#features">
              See How It Works
              <ChevronRight className="ml-1 h-4 w-4" />
            </a>
          </Button>
        </div>
      </div>
    </section>
  );
}

function TrustedBySection() {
  return (
    <section className="border-y border-zinc-800/50 bg-zinc-900/30 py-12">
      <div className="mx-auto max-w-6xl px-6 text-center">
        <p className="text-sm text-zinc-500 uppercase tracking-wider font-medium mb-8">
          Built for leading research institutions
        </p>
        <div className="flex flex-wrap items-center justify-center gap-x-12 gap-y-6">
          {["Your University", "Research Lab", "Medical Center", "Institute of Technology", "School of Sciences"].map(
            (name) => (
              <span
                key={name}
                className="text-zinc-600 text-lg font-semibold tracking-tight"
              >
                {name}
              </span>
            )
          )}
        </div>
      </div>
    </section>
  );
}

function FeaturesSection() {
  return (
    <section id="features" className="py-24">
      <div className="mx-auto max-w-6xl px-6">
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">
            Everything your researchers need
          </h2>
          <p className="mt-4 text-lg text-zinc-400 max-w-2xl mx-auto">
            A complete literature review platform that replaces fragmented workflows
            with a single, AI-enhanced environment.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature) => (
            <Card
              key={feature.title}
              className="bg-zinc-900/50 border-zinc-800 hover:border-zinc-700 transition-colors"
            >
              <CardContent className="pt-6">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/10 mb-4">
                  <feature.icon className="h-5 w-5 text-emerald-400" />
                </div>
                <h3 className="text-base font-semibold mb-2">{feature.title}</h3>
                <p className="text-sm text-zinc-400 leading-relaxed">
                  {feature.description}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}

function ValuePropsSection() {
  return (
    <section className="py-24 bg-zinc-900/30 border-y border-zinc-800/50">
      <div className="mx-auto max-w-6xl px-6">
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">
            Built for institutional scale
          </h2>
          <p className="mt-4 text-lg text-zinc-400 max-w-2xl mx-auto">
            No per-seat licensing. No data leaving your infrastructure. No vendor lock-in.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {valueProps.map((prop) => (
            <div key={prop.title} className="text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500/20 to-teal-500/20 border border-emerald-500/10 mx-auto mb-5">
                <prop.icon className="h-7 w-7 text-emerald-400" />
              </div>
              <h3 className="text-lg font-semibold mb-3">{prop.title}</h3>
              <p className="text-sm text-zinc-400 leading-relaxed max-w-xs mx-auto">
                {prop.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function StatsSection() {
  return (
    <section className="py-20">
      <div className="mx-auto max-w-4xl px-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          {stats.map((stat) => (
            <div key={stat.label} className="text-center">
              <p className="text-3xl font-bold text-emerald-400">{stat.value}</p>
              <p className="text-sm text-zinc-400 mt-1">{stat.label}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function DemoRequestSection() {
  const [formState, setFormState] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFormState("submitting");
    setErrorMsg("");

    const form = e.currentTarget;
    const data = {
      name: (form.elements.namedItem("name") as HTMLInputElement).value,
      email: (form.elements.namedItem("email") as HTMLInputElement).value,
      institution: (form.elements.namedItem("institution") as HTMLInputElement).value,
      role: (form.elements.namedItem("role") as HTMLSelectElement).value,
      message: (form.elements.namedItem("message") as HTMLTextAreaElement).value,
    };

    try {
      const res = await fetch("/api/demo-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to submit");
      setFormState("success");
    } catch {
      setErrorMsg("Something went wrong. Please try again.");
      setFormState("error");
    }
  }

  return (
    <section id="demo" className="py-24 bg-zinc-900/30 border-t border-zinc-800/50">
      <div className="mx-auto max-w-2xl px-6">
        <div className="text-center mb-12">
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">
            Request a Demo
          </h2>
          <p className="mt-4 text-lg text-zinc-400">
            See how Tessera can accelerate research output at your institution.
          </p>
        </div>

        {formState === "success" ? (
          <Card className="bg-zinc-900/50 border-emerald-500/30">
            <CardContent className="pt-8 pb-8 text-center">
              <CheckCircle2 className="h-12 w-12 text-emerald-400 mx-auto mb-4" />
              <h3 className="text-xl font-semibold mb-2">Thank you!</h3>
              <p className="text-zinc-400">
                We&apos;ve received your request and will be in touch shortly.
              </p>
            </CardContent>
          </Card>
        ) : (
          <Card className="bg-zinc-900/50 border-zinc-800">
            <CardContent className="pt-8">
              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div>
                    <label htmlFor="name" className="block text-sm font-medium mb-2">
                      Name
                    </label>
                    <input
                      id="name"
                      name="name"
                      type="text"
                      required
                      className="w-full rounded-md border border-zinc-800 bg-zinc-950 px-4 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 transition-colors"
                      placeholder="Dr. Jane Smith"
                    />
                  </div>
                  <div>
                    <label htmlFor="email" className="block text-sm font-medium mb-2">
                      Email
                    </label>
                    <input
                      id="email"
                      name="email"
                      type="email"
                      required
                      className="w-full rounded-md border border-zinc-800 bg-zinc-950 px-4 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 transition-colors"
                      placeholder="jane@university.edu"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div>
                    <label htmlFor="institution" className="block text-sm font-medium mb-2">
                      Institution
                    </label>
                    <input
                      id="institution"
                      name="institution"
                      type="text"
                      required
                      className="w-full rounded-md border border-zinc-800 bg-zinc-950 px-4 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 transition-colors"
                      placeholder="University of Example"
                    />
                  </div>
                  <div>
                    <label htmlFor="role" className="block text-sm font-medium mb-2">
                      Role
                    </label>
                    <select
                      id="role"
                      name="role"
                      required
                      className="w-full rounded-md border border-zinc-800 bg-zinc-950 px-4 py-2.5 text-sm text-zinc-100 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 transition-colors"
                    >
                      <option value="">Select your role</option>
                      {roles.map((role) => (
                        <option key={role} value={role}>
                          {role}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label htmlFor="message" className="block text-sm font-medium mb-2">
                    Message <span className="text-zinc-500 font-normal">(optional)</span>
                  </label>
                  <textarea
                    id="message"
                    name="message"
                    rows={4}
                    className="w-full rounded-md border border-zinc-800 bg-zinc-950 px-4 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 transition-colors resize-none"
                    placeholder="Tell us about your research needs or any questions you have..."
                  />
                </div>

                {formState === "error" && (
                  <p className="text-sm text-red-400">{errorMsg}</p>
                )}

                <Button
                  type="submit"
                  disabled={formState === "submitting"}
                  className="w-full bg-emerald-600 hover:bg-emerald-500 text-white h-11 text-base"
                >
                  {formState === "submitting" ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      Submitting...
                    </>
                  ) : (
                    "Request a Demo"
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>
        )}
      </div>
    </section>
  );
}

function SiteFooter() {
  return (
    <footer className="border-t border-zinc-800/50 bg-zinc-950 py-12">
      <div className="mx-auto max-w-6xl px-6">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600">
              <BookOpen className="h-4 w-4 text-white" />
            </div>
            <span className="font-semibold">Tessera</span>
          </div>
          <div className="flex items-center gap-6 text-sm text-zinc-500">
            <Link href="/dashboard" className="hover:text-zinc-300 transition-colors">
              Open App
            </Link>
            <a href="#features" className="hover:text-zinc-300 transition-colors">
              Features
            </a>
            <a href="#demo" className="hover:text-zinc-300 transition-colors">
              Contact
            </a>
          </div>
        </div>
        <div className="mt-8 pt-8 border-t border-zinc-800/50 text-center text-xs text-zinc-600">
          &copy; {new Date().getFullYear()} Tessera. Built with Next.js.
        </div>
      </div>
    </footer>
  );
}
