# Visionary Hub

Build a premium, modern, production-quality frontend UI for a Computer Vision AI Platform.

IMPORTANT SCOPE

For now, build ONLY THE FRONTEND AND UI/UX.

Do NOT build the actual computer vision models, backend APIs, database, authentication, AI processing, detection logic, or technical ML configuration.

Use realistic mock data, simulated detection results, dummy live camera states, and frontend-only interactions so the entire product looks and feels like a real working computer vision platform.

The frontend must be fully responsive and look perfect on:

Mobile phones

Tablets

Laptops

Desktop computers

Large monitors

The UI must intelligently adapt to every screen size. Do not simply shrink the desktop layout for mobile. Create proper responsive layouts for each device size.

PRODUCT CONCEPT

Create a unified Computer Vision Monitoring Platform with separate AI pipelines.

The application should contain 5 completely separate tabs/pipelines.

Each pipeline represents a different computer vision use case.

The pipelines are:

Smart Attendance & Face Recognition

Kitchen Hygiene & PPE Detection

Vehicle Number Plate Detection

Security Guard Activity Monitoring

Restricted Area Intrusion Detection

Each pipeline must have its own:

Unique UI

Unique dashboard layout

Unique camera/upload workflow

Unique result presentation

Unique statistics

Unique detection visualization

Unique history/results section

Download/export actions

Settings interface designed only for normal users

Do not make every tab look like a copy of the others with different titles. Each pipeline should have a distinct experience appropriate for its purpose while still maintaining one consistent overall product design system.

GENERAL DESIGN DIRECTION

Create a high-end AI SaaS dashboard.

The design should feel:

Premium

Modern

Clean

Intelligent

Professional

Futuristic

Minimal but visually impressive

Enterprise-ready

Use excellent spacing, typography, hierarchy, cards, icons, subtle animations, polished hover effects, loading states, empty states, and transitions.

The UI should communicate that this is an advanced real-time computer vision platform.

Suggested visual style:

Sophisticated dark/light interface with strong contrast

Modern dashboard cards

Rounded corners

Clean borders

Subtle shadows

Glass or soft translucent effects where appropriate

Professional AI/data visualization elements

Smooth micro-interactions

Animated live status indicators

Beautiful camera preview containers

Modern charts and statistics

Responsive side navigation

Do not overuse glowing effects, gradients, glassmorphism, or animations. Keep the product professional and polished.

APPLICATION STRUCTURE

1. MAIN APP LAYOUT

Create a main application shell containing:

Desktop / Laptop

A premium collapsible sidebar with:

Platform logo

Platform name

Dashboard

The 5 computer vision pipelines

Settings

Help/Support

User profile area

The 5 main pipelines should be visually easy to identify using meaningful icons.

The sidebar should support:

Expanded mode

Collapsed icon-only mode

Active tab highlighting

Smooth transitions

Tablet

Adapt the sidebar intelligently depending on available width.

Possible behavior:

Compact sidebar

Icon navigation

Slide-out navigation

Mobile

Use a proper mobile navigation experience.

Do not show a cramped desktop sidebar.

Use:

Top header

Menu button

Slide-out navigation drawer

Or another premium mobile-friendly navigation pattern

The active pipeline must always be easy to understand.

2. GLOBAL TOP HEADER

Create a clean responsive header containing:

Current pipeline name

Short contextual description

Overall system status

Notification icon

Optional date/time

User profile menu

For example:

Smart Attendance
"Real-time face recognition and attendance monitoring"

Include a subtle global system indicator such as:

● System Ready

or:

● Camera Active

This should be simulated using frontend state.

PIPELINE 1 — SMART ATTENDANCE & FACE RECOGNITION

This pipeline is for recognizing registered people and recording attendance.

Main Experience

The user should have two main ways to provide visual input:

A. Live Camera

Include a prominent:

Connect Camera

button.

When clicked, the frontend should support the browser camera permission flow.

The UI should be designed around the concept that:

The browser asks the user for permission

The user can select an available camera device

The selected camera name is displayed

The live camera preview appears

A clear LIVE indicator is shown

The user can start/stop the simulated session

Also include a clean interface for changing the selected camera.

B. Upload Media

Include options for:

Upload Image

Upload Video

Create an elegant drag-and-drop upload area.

Show appropriate preview states after a file is selected.

Person Registration

Create a dedicated Registered Persons section.

The user should be able to see cards or rows containing:

Person photo

Full name

Person/Employee ID

Recognition status

Last seen

Small action menu

Include an attractive:

+ Register New Person

button.

The registration UI should allow:

Upload/select person photo

Enter name

Enter ID

This is frontend-only, so simulate successful registration.

Live Detection View

During a simulated live session, create a camera feed UI with:

Face bounding boxes

Person names

Recognition confidence

Recognized / Unknown labels

Timestamp

Live indicator

Make the detection overlay visually realistic.

Attendance Results

Show results such as:

Total people detected

Recognized

Unknown

Present today

Attendance percentage

Display recent attendance in a polished table/list.

Columns may include:

Person

Photo

Check-in time

Recognition confidence

Status

Include:

Search

Filters

Date selector

Download Attendance Report

Export/download actions should be frontend UI interactions with mock functionality.

PIPELINE 2 — KITCHEN HYGIENE & PPE DETECTION

This pipeline monitors kitchen staff and hygiene compliance.

The UI should visually feel different from the attendance pipeline.

Detection Targets

Display compliance categories such as:

Face Mask

Gloves

Hair Cover / Hair Net

Proper PPE

Hygiene Violation

Input Options

Provide:

Connect Live Camera

Upload Image

Upload Video

Create the same high-quality camera and upload experience, but with a unique pipeline layout.

Live Monitoring Dashboard

Create a large monitoring area showing a simulated kitchen camera.

Overlay realistic detection boxes on people.

For each detected person, show status such as:

✓ Mask

✓ Gloves

✕ No Gloves

⚠ PPE Violation

Compliance Summary

Create visual statistics:

Total Staff Detected

Fully Compliant

Violations

Compliance Score

Use attractive charts, progress indicators, and KPI cards.

Violation Feed

Create a visually prominent recent violations section.

Each event should include:

Snapshot thumbnail

Detected issue

Person ID if available

Camera/source

Time

Severity

Example:

⚠ Missing Gloves
Kitchen Camera 01 · 10:42 AM

Include:

Download Compliance Report

PIPELINE 3 — VEHICLE NUMBER PLATE DETECTION

This pipeline detects cars and motorcycles and reads their license plate numbers.

The design should resemble a smart traffic/security monitoring interface.

Input

Provide:

Connect Camera

Upload Vehicle Image

Upload Video

Include drag-and-drop functionality.

Detection View

Create a large camera/media preview.

Simulate:

Vehicle bounding boxes

Car labels

Motorcycle labels

Number plate bounding boxes

Detected plate text

Example visual overlay:

CAR
Confidence: 98%

PLATE: ABC-123

Make the plate detection result highly visible and easy to read.

Detection Results

Create a modern results panel containing:

Vehicle type

License plate number

Confidence

Detection time

Snapshot

Allow users to:

Search by plate number

Filter by vehicle type

Filter by date/time

View details

Download results

Statistics

Show:

Total Vehicles

Cars

Motorcycles

Unique Plates

Add appropriate visualizations.

PIPELINE 4 — SECURITY GUARD ACTIVITY MONITORING

This pipeline monitors whether a security guard is properly performing their duty.

The UI should focus on real-time activity and alerts.

Activity States

Simulate states such as:

On Duty

Alert

Standing

Sitting

Sleeping

Absent from Position

Live Monitoring

Create a large camera view showing a simulated security guard detection.

Display a prominent current status panel.

For example:

CURRENT STATUS

🟢 ON DUTY
Guard appears alert and present.

or:

🔴 POSSIBLE SLEEPING DETECTED

Make warning states visually clear without making the UI look alarming or messy.

Timeline

Create an activity timeline showing:

09:00 — On Duty

10:15 — Standing

11:20 — Sitting

12:05 — Alert

etc.

Session Statistics

Show:

Duty Duration

Alert Time

Inactive Time

Sleep Events

Absence Events

Alert History

Display a clean event history with:

Event

Time

Duration

Snapshot

Severity

Include:

Download Activity Report

PIPELINE 5 — RESTRICTED AREA INTRUSION DETECTION

This pipeline detects when someone enters a restricted area.

The UI should feel like a security monitoring center.

Camera Monitoring

Include:

Connect Camera

Select Camera

Upload Image

Upload Video

Show a simulated live camera feed.

Restricted Zone

The video preview should visually demonstrate a defined restricted area.

Use a translucent polygon/rectangle overlay to mark the restricted zone.

Clearly label it:

RESTRICTED AREA

The UI should show the concept that if a person enters this area, an intrusion is detected.

Intrusion Detection

Simulate:

Person detection boxes

Restricted zone overlay

Normal safe status

Intrusion warning state

Example:

STATUS: SECURE

No unauthorized activity detected.

When mock data changes:

⚠ INTRUSION DETECTED

Person entered Restricted Zone A.

Event Log

Show intrusion events containing:

Snapshot

Zone

Time

Person detected

Event status

Statistics

Display:

Current Status

Intrusions Today

Total Persons Detected

Active Cameras

Last Intrusion

Include:

Download Security Report

USER-FRIENDLY SETTINGS

Each pipeline should have its own settings option.

However, these settings must be designed for normal end users, not developers or ML engineers.

Do NOT expose:

Model parameters

Threshold configuration

YOLO settings

Neural network configuration

API keys

Backend URLs

Embeddings

GPU settings

Technical computer vision parameters

Raw JSON configuration

Instead, provide simple user-friendly controls.

Examples:

Camera Settings

Select Camera

Camera Name

Video Quality

Enable/Disable Camera

Notification Settings

Enable Alerts

Browser Notifications

Sound Alerts

Display Settings

Show Detection Boxes

Show Labels

Show Confidence

Compact View

Use simple toggles, dropdowns, sliders only where intuitive, and clear explanations.

RESULTS AND DOWNLOAD EXPERIENCE

Every pipeline must have a clear way to access its results.

Each pipeline should include an appropriate:

Results history

Search

Filters

Detail view

Statistics

Download/Export button

The download experience should feel realistic.

For example, clicking download can open a polished modal:

Download Report

Select format:

PDF

CSV

Select date range:

Today

Last 7 Days

Last 30 Days

Custom Range

Then:

Generate Report

Since this is frontend-only, simulate the download/generation process.

RESPONSIVE REQUIREMENTS

This is extremely important.

Mobile

The mobile UI must be designed first-class.

No horizontal scrolling

Large camera preview

Touch-friendly buttons

Bottom sheets or drawers where appropriate

Tables should transform intelligently into cards/lists

Statistics should stack properly

Sidebar should become mobile navigation

Forms should be easy to use

Upload areas should fit small screens

Tablet

Use responsive grids.

For example:

Two-column layouts when appropriate

Compact controls

Flexible camera/results arrangement

Laptop/Desktop

Take advantage of the available screen space.

For monitoring pipelines, create professional layouts such as:

Large camera view on the left

Live results/status on the right

Statistics below

History/activity panels underneath

Do not leave excessive empty space.

Large Screens

Scale gracefully without making content excessively wide.

Use maximum content widths and intelligent grids.

UI STATES

Design all important states, not just the ideal screen.

Include polished UI for:

Camera States

Camera not connected

Permission required

Connecting

Connected

Live

Camera stopped

Camera unavailable

Upload States

Empty upload state

Dragging file

Uploading

Processing

Completed

Error

Detection States

Waiting for input

Processing

No objects detected

Successful detections

Warning/violation

Critical event

General States

Loading skeletons

Empty history

No search results

Error message

Success notification

INTERACTIONS AND ANIMATIONS

Use smooth, professional animations.

Examples:

Sidebar collapse/expand

Tab transitions

Camera connection state transitions

Detection cards appearing

Statistics updating

Alert notifications

Modal opening/closing

Upload progress

Hover states

Button feedback

Animations must be subtle and fast.

Do not create distracting or excessive animations.

ACCESSIBILITY

Ensure:

Strong color contrast

Readable text

Clear labels

Keyboard-friendly interactions where possible

Icons should have tooltips where necessary

Important status information should not depend only on color

Mobile touch targets should be appropriately sized

COMPONENT CONSISTENCY

Create a reusable design system with consistent:

Buttons

Input fields

Cards

Modals

Dropdowns

Toggles

Tables

Badges

Status indicators

Tooltips

Toast notifications

Loading components

Empty states

Download/export dialogs

However, do not force every pipeline into the exact same page structure.

Maintain design consistency while allowing each pipeline to have its own specialized dashboard.

FRONTEND FUNCTIONALITY

Although there is no backend, the frontend should feel functional.

Implement frontend-only interactions for:

Switching between pipelines

Opening/closing settings

Opening camera connection UI

Browser camera permission workflow where possible

Selecting available cameras

Starting/stopping camera preview

Uploading images/videos locally for preview

Registering a person using mock state

Searching/filtering mock results

Changing tabs/views

Opening detection details

Simulating real-time detections

Changing mock system states

Download/export UI simulation

Notifications/toasts

Responsive navigation

Use local frontend state and realistic mock data.

IMPORTANT DESIGN GOAL

The final product should not look like a generic admin dashboard.

It should look like a premium commercial Computer Vision AI Platform that could realistically be demonstrated to:

Companies

Security teams

Universities

Restaurants

Factories

Enterprises

Potential clients

The UI should immediately communicate:

Real-Time AI Vision · Monitoring · Detection · Analytics

FINAL DELIVERABLE

Create a complete, polished frontend with:

Main responsive application layout

Responsive navigation

Dashboard/home experience

All 5 separate computer vision pipelines

Unique UI and results presentation for every pipeline

Camera connection and live preview UI

Image and video upload UI

Mock real-time detection states

Person registration UI for attendance

User-friendly settings for each pipeline

Statistics and analytics

Results/history pages or sections

Search and filtering

Download/export interfaces

Modals, alerts, notifications, loading states, and empty states

Fully responsive mobile, tablet, laptop, and desktop experience

FINAL RESTRICTION

This phase is FRONTEND/UI ONLY.

Do not spend time implementing actual AI models, backend services, APIs, databases, authentication systems, computer vision processing, or technical machine learning configuration.

Focus completely on creating an exceptionally beautiful, realistic, interactive, responsive, production-quality frontend experience.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
