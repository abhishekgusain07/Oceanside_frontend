import React from 'react';

const LicenseAgreement = () => {
  return (
    <main className="mx-auto max-w-3xl px-4 py-20">
      <div className="prose prose-gray dark:prose-invert mx-auto flex flex-col gap-8">
        <div>
          <h1 className="text-3xl font-semibold">Oceanside Collaborative Recording License Agreement</h1>
        </div>
        
        <div>
          <h4 className="text-lg font-semibold">TL;DR;</h4>
          <h4 className="text-lg"><strong>Standard License: </strong>Use for individual or team collaborative recording projects.</h4>
          <h4 className="text-lg"><strong>Enterprise License: </strong>Unlimited usage with advanced features and priority support.</h4>
        </div>
        
        <div>
          This License Agreement ('Agreement') is entered into between Oceanside Collaborative Recording ('Oceanside'), and you, the user ('Licensee'), regarding the use of the Oceanside collaborative recording platform (the 'Product') available at oceanside.dev. By downloading, accessing, or using the Product, Licensee agrees to be bound by the terms and conditions of this Agreement.
        </div>
        
        <span className="text-lg font-semibold">1. Grant of License</span>
        
        <div className="flex flex-col gap-8">
          <span className="font-semibold">1.1 Standard License</span>
          <span>
            Subject to the terms and conditions of this Agreement, Oceanside grants Licensee a non-exclusive, non-transferable, and non-sublicensable Standard License to use the Oceanside collaborative recording platform for the following purposes:
          </span>
          <ul>
            <li>Create and manage collaborative recording sessions.</li>
            <li>Record high-quality audio and video content.</li>
            <li>Collaborate with up to 5 participants per session.</li>
            <li>Store and manage recording sessions for personal or professional use.</li>
          </ul>
        </div>
        
        <div className="flex flex-col gap-8">
          <span className="font-semibold">1.2 Enterprise License</span>
          <span>
            Subject to the terms and conditions of this Agreement, Oceanside grants Licensee a non-exclusive, non-transferable, and non-sublicensable Enterprise License to use the Oceanside collaborative recording platform for the following purposes:
          </span>
          <ul>
            <li>Unlimited collaborative recording sessions.</li>
            <li>Advanced recording and collaboration features.</li>
            <li>Unlimited participants per session.</li>
            <li>Extended cloud storage capabilities.</li>
            <li>Receive priority support and platform updates.</li>
            <li>Custom branding and integration options.</li>
          </ul>
        </div>
        
        <span className="text-lg font-semibold">2. Restrictions</span>
        
        <div className="flex flex-col gap-8">
          <span>Licensee shall not:</span>
          <ul>
            <li>Resell or redistribute the Oceanside recording platform as a standalone product.</li>
            <li>Create derivative platforms for distribution or sale.</li>
            <li>Remove, alter, or obscure any copyright, trademark, or other proprietary notices.</li>
            <li>Use the platform for illegal recording or violating privacy laws.</li>
            <li>Sub-license, rent, lease, or transfer the platform or any rights granted under this Agreement.</li>
          </ul>
        </div>
        
        <div className="mt-10 flex flex-col gap-10">
          <div className="grid gap-4">
            <span className="text-lg font-semibold">3. Ownership and Intellectual Property</span>
            <span>
              Oceanside retains all ownership and intellectual property rights in and to the collaborative recording platform. This Agreement does not grant Licensee any ownership rights in the platform.
            </span>
          </div>
          
          <div className="grid gap-4">
            <span className="text-lg font-semibold">4. Warranty and Disclaimer</span>
            <span>
              THE OCEANSIDE RECORDING PLATFORM IS PROVIDED 'AS IS' WITHOUT WARRANTY OF ANY KIND, EITHER EXPRESS OR IMPLIED, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, OR NONINFRINGEMENT.
            </span>
          </div>
          
          <div className="grid gap-4">
            <span className="text-lg font-semibold">5. Limitation of Liability</span>
            <span>
              TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, OCEANSIDE SHALL NOT BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES ARISING OUT OF OR RELATING TO THE USE OR INABILITY TO USE THE RECORDING PLATFORM.
            </span>
          </div>
          
          <div className="grid gap-4">
            <span className="text-lg font-semibold">6. Governing Law and Jurisdiction</span>
            <span>
              This Agreement shall be governed by and construed in accordance with the laws of the United States, without regard to its conflict of law principles. Any dispute arising out of or in connection with this Agreement shall be subject to the exclusive jurisdiction of the courts located in the United States.
            </span>
          </div>
          
          <div className="grid gap-4">
            <span className="text-lg font-semibold">7. Entire Agreement</span>
            <span>
              This Agreement constitutes the entire agreement between Licensee and Oceanside concerning the subject matter herein and supersedes all prior or contemporaneous agreements, representations, warranties, and understandings.
            </span>
          </div>
        </div>
        
        <div className="flex flex-col">
          <span>Last updated: 2024-07-01</span>
          <span>Oceanside Collaborative Recording Platform</span>
          <span>Contact Information: support@oceanside.dev</span>
        </div>
      </div>
    </main>
  );
};

export default LicenseAgreement;