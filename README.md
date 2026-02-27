# Attendance System Admin Web Portal

A React-based admin dashboard for the Employee Attendance Tracking System. It provides administrators with a comprehensive interface to manage office areas, view employee attendance logs, and monitor geospatial tracking data.

## Features

- **Dashboard:** Overview of daily attendance, late arrivals, and absent employees.
- **Geofence Management:** Create, view, and manage office areas using both circular and polygon (KML/GeoJSON) geofences across an interactive map.
- **Attendance Management:** Review attendance records, including photo evidence and reasons for late arrivals or outstation check-ins.
- **GPS History Tracking:** View historical GPS movement traces and logs of field staff directly on the map.
- **QR Code Management:** Generate and view dynamic QR codes for secure check-ins.
- **User Management:** Monitor employee records and their roles.

## Tech Stack

- **Framework:** React 18 with Vite
- **Language:** TypeScript
- **Styling:** Tailwind CSS, Headless UI
- **Maps:** Leaflet, React-Leaflet, Leaflet Omnivore
- **Icons:** Lucide React
- **HTTP Client:** Axios
- **Routing:** React Router DOM
- **Miscellaneous:** React Hot Toast, QRCode React

## Getting Started

### Prerequisites

- Node.js (v18 or higher recommended)
- npm or yarn

### Installation

1. Navigate to the `AttendanceWeb` directory.
   ```bash
   cd AttendanceWeb
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Configure your environment variables.
   You need to point the frontend to your Spring Boot backend instance. Create a `.env` file in the root directory (or `.env.local`) and add your backend API URL. For localized development:
   ```env
   VITE_API_BASE_URL=http://localhost:8080/api
   ```

4. Start the development server:
   ```bash
   npm run dev
   ```

### Building for Production

To create an optimized production build, run:

```bash
npm run build
```

This will run TypeScript type checking and compile the application into the `dist` folder.

## Project Structure

```text
src/
├── assets/        # Static UI assets and images
├── components/    # Reusable UI components (buttons, modals, layout elements)
├── contexts/      # React contexts (e.g., AuthProvider for JWT state)
├── hooks/         # Custom React hooks (e.g., useAuth)
├── pages/         # Page-level components corresponding to application routes
├── services/      # API communication layer (Axios instances, endpoint wrappers)
├── types/         # Global TypeScript interfaces and type definitions
└── utils/         # Helper functions (e.g., date formatting, mapping utilities)
```

## Maintenance & Tasks

- Ensure to keep Leaflet and its associated React wrapper up to date to maintain map stability.
- The built-in Vite linting strategy restricts the usage of standard React Compiler for optimal performance out-of-the-box. Ensure you update `tsconfig.json` paths if restructuring the `/src/` folder.
- Follow ESLint standard practices as configured to maintain cleanly typed components.

## License

This project is for internal use for the Attendance System Digital Transformation.
