"use client"

import { useState } from "react"
import { useRouter } from 'next/navigation'
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

interface Field {
  id: string;
  label: string;
  placeholder: string;
  optional?: boolean;
  prefix?: string;
}

interface Option {
  id: string;
  title: string;
  description: string;
}

interface Step {
  title: string;
  subtitle: string;
  fields?: Field[];
  options?: Option[];
  completionIcon?: boolean;
}

const steps: Step[] = [
  {
    title: "Welcome! First things first...",
    subtitle: "You can always change them later.",
    fields: [
      { id: "fullName", label: "Full Name", placeholder: "Steve Jobs" },
      { id: "displayName", label: "Display Name", placeholder: "Steve" },
    ]
  },
  {
    title: "Let's set up a home for all your work",
    subtitle: "You can always create another workspace later.",
    fields: [
      { id: "workspaceName", label: "Workspace Name", placeholder: "Eden" },
      { id: "workspaceUrl", label: "Workspace URL", placeholder: "Example", optional: true, prefix: "www.eden.com/" },
    ]
  },
  {
    title: "How are you planning to use Eden?",
    subtitle: "We'll streamline your setup experience accordingly.",
    options: [
      { id: "myself", title: "For myself", description: "Write better. Think more clearly. Stay organized." },
      { id: "team", title: "With my team", description: "Wikis, docs, tasks & projects, all in one place." },
    ]
  },
  {
    title: "Congratulations, you're all set!",
    subtitle: "You have completed onboarding, you can start using the platform.",
    completionIcon: true
  }
];

export default function OnboardingPage() {
  const router = useRouter()
  const [currentStep, setCurrentStep] = useState(1)
  const [formData, setFormData] = useState({
    fullName: "",
    displayName: "",
    workspaceName: "",
    workspaceUrl: "",
    usageType: "",
  })

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  const handleSelectOption = (optionId: string) => {
    setFormData(prev => ({ ...prev, usageType: optionId }))
  }

  const nextStep = () => {
    if (currentStep < steps.length) {
      setCurrentStep(prev => prev + 1)
    }
  }

  const handleComplete = () => {
    console.log("Form data submitted:", formData)
    router.push("/dashboard")
  }

  // Get current step data
  const currentStepData = steps[currentStep - 1] || steps[0];

  return (
    <div className="min-h-screen flex flex-col items-center px-4 py-16 bg-white">
      {/* Logo */}
      <div className="mb-12">
        <div className="flex justify-center">
          <div className="h-12 w-12 bg-indigo-600 rounded-md flex items-center justify-center mb-4">
            <span className="text-white text-xl font-bold">P</span>
          </div>
        </div>
        <h1 className="text-2xl font-bold text-center text-slate-800">Printmoney</h1>
      </div>

      {/* Step Indicators */}
      <div className="flex items-center mb-16 w-full max-w-md mx-auto">
        {Array.from({ length: steps.length }).map((_, idx) => (
          <div key={idx} className="flex-1 flex items-center">
            <div 
              className={`w-10 h-10 rounded-full flex items-center justify-center ${
                idx + 1 <= currentStep 
                  ? "bg-indigo-600 text-white" 
                  : "bg-white text-slate-400 border border-slate-200"
              }`}
            >
              {idx + 1}
            </div>
            {idx < steps.length - 1 && (
              <div 
                className={`h-[1px] flex-1 ${
                  idx + 2 <= currentStep ? "bg-indigo-600" : "bg-slate-200"
                }`}
              />
            )}
          </div>
        ))}
      </div>

      {/* Content */}
      <div className="w-full max-w-md mx-auto">
        <div className="text-center mb-10">
          <h2 className="text-3xl font-bold text-slate-800 mb-2">
            {currentStepData.title}
          </h2>
          <p className="text-slate-500">
            {currentStepData.subtitle}
          </p>
        </div>

        {/* Completion Icon */}
        {currentStepData.completionIcon && (
          <div className="flex justify-center mb-10">
            <div className="h-16 w-16 bg-indigo-600 rounded-full flex items-center justify-center">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M20 6L9 17L4 12" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
          </div>
        )}

        {/* Form Fields */}
        {currentStepData.fields && currentStepData.fields.length > 0 && (
          <div className="space-y-4 mb-8">
            {currentStepData.fields.map((field) => (
              <div key={field.id} className="space-y-2">
                <Label htmlFor={field.id}>
                  {field.label} {field.optional && <span className="text-slate-400 text-sm">(optional)</span>}
                </Label>
                {field.prefix ? (
                  <div className="flex">
                    <div className="bg-slate-100 px-3 py-2 rounded-l-md border border-r-0 border-slate-200 text-slate-500">
                      {field.prefix}
                    </div>
                    <Input
                      id={field.id}
                      name={field.id}
                      placeholder={field.placeholder}
                      value={formData[field.id as keyof typeof formData] as string}
                      onChange={handleInputChange}
                      className="rounded-l-none flex-1"
                    />
                  </div>
                ) : (
                  <Input
                    id={field.id}
                    name={field.id}
                    placeholder={field.placeholder}
                    value={formData[field.id as keyof typeof formData] as string}
                    onChange={handleInputChange}
                  />
                )}
              </div>
            ))}
          </div>
        )}

        {/* Options */}
        {currentStepData.options && currentStepData.options.length > 0 && (
          <div className="grid grid-cols-2 gap-4 mb-8">
            {currentStepData.options.map((option) => (
              <div 
                key={option.id}
                className={`p-4 border rounded-md cursor-pointer transition-all ${
                  formData.usageType === option.id 
                    ? "border-indigo-600 bg-indigo-50" 
                    : "border-slate-200 hover:border-slate-300"
                }`}
                onClick={() => handleSelectOption(option.id)}
              >
                <div className="flex items-center mb-2">
                  <div className={`w-5 h-5 rounded-md ${formData.usageType === option.id ? "bg-indigo-600" : "bg-slate-200"}`} />
                </div>
                <h3 className="font-medium text-slate-800">{option.title}</h3>
                <p className="text-sm text-slate-500">{option.description}</p>
              </div>
            ))}
          </div>
        )}
        
        {/* Action Button */}
        <Button 
          className="w-full py-6 bg-indigo-600 hover:bg-indigo-700"
          onClick={currentStep === steps.length ? handleComplete : nextStep}
        >
          {currentStep === steps.length ? "Launch Eden" : "Create Workspace"}
        </Button>
      </div>
    </div>
  )
} 