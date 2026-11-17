# DayPilot – Daily Planner

DayPilot is an offline-first personal planner built with React Native and Expo for Android and iOS.

## Included in this starter
- Four-tab layout: My Day, Planner, Notes and Progress
- Local persistence using AsyncStorage
- Daily greeting and editable display name
- Habit check-ins and task completion
- Monthly event calendar
- General notes
- Light/dark colour themes (toggle wiring is planned for the settings iteration)
- Quick-add sheet

## Requirements
- Node.js 22 LTS recommended
- npm
- Expo Go on a phone for the first preview

## Run locally
```bash
npm install
npx expo start
```
Scan the QR code with Expo Go. For Android emulator use `npm run android`.

## Build Android APK
Install EAS CLI and sign in:
```bash
npm install -g eas-cli
eas login
eas build:configure
eas build --profile preview --platform android
```

The preview profile is configured for an installable APK. For Play Store, use:
```bash
eas build --profile production --platform android
```

## Build iOS
```bash
eas build --profile production --platform ios
```
An Apple Developer account and signing credentials are required for App Store distribution.

## Important
This is the first runnable foundation, not the finished product. Full recurring schedules, date-based planner notes, native reminders, robust habit frequency/streak rules, Tamil localization, app lock/biometrics, editable event workflows and detailed reports still need implementation and testing before release.
