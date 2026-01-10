# Team 4201 Scouting System

[![Build all components](https://github.com/4201VitruvianBots/scouting-app-2025/actions/workflows/build.yml/badge.svg)](https://github.com/4201VitruvianBots/scouting-app-2025/actions/workflows/build.yml) [![Format with Prettier](https://github.com/4201VitruvianBots/scouting-app-2025/actions/workflows/format.yml/badge.svg)](https://github.com/4201VitruvianBots/scouting-app-2025/actions/workflows/format.yml)

## Overview

Over the past several years, our team has designed an all-in-one system for robot scouting. Everything for the system has been packed into a rolling tote (Keter Masterloader Pro 24" Rolling Tool Box) that we can easily take into competition. The full system is connected as shown below:

![full scouting tote diagram](images/scouting_tote_diagram.png)

## System Setup

Once everything is connected correctly based on the diagram above, follow the steps below to get everything running.

On the Scouting Laptop, do the following:

-   Set the static IP on your computer to `192.168.1.200`. If you don't know how to do this, search on Google "how to set static IP on " + the operating system you're running on.
-   Install Visual Studio Code (VSCode) on the computer [(Visual Studio Code Install)](https://code.visualstudio.com/download)
-   Install Node Version Manager (nvm) on the computer [(nvm for Linux)](https://github.com/nvm-sh/nvm), [(nvm for Windows)](https://github.com/coreybutler/nvm-windows)
-   Following the instructions provided by nvm in the prior step, install the latest Node version with the command `nvm install node`. Once installed, run `nvm use node`.
-   Install Docker Desktop on the computer [(Docker Desktop for Linux)](https://docs.docker.com/desktop/setup/install/linux/), [(Docker Desktop for Windows)](https://docs.docker.com/desktop/setup/install/windows-install/)
-   Install GitKraken on the computer [(GitKraken Install)](https://www.gitkraken.com/download)
-   Clone the `scouting-app-2025` repository using Git to the laptop
-   Open the `scouting-app-2025` folder in VSCode. Once open, create a new terminal (`Terminal` > `New Terminal`), and run the command `npm install`
-   Once the install command completes, run the command `npm run build --workspace database` to build our database image
-   As long as the previous command completed successfully, run the command `npm run start` to start the server.

If all the steps above complete correctly, after running `npm run start` you should see something similar to the following in your terminal:

```bash
$ npm run start

> scouting-app-2025@1.0.0 start
> npm run start --workspace server


> server@1.0.0 start
> node dist/index.js

Container "cala-quals" does not exist.
Creating and starting a new container...
Started container
Server running at http://localhost:8080
```

To load the scouting apps on tablets, follow these steps:

-   Connect each tablet to the system via ethernet adapter (as pictured above)
-   On each tablet, go into Google Chrome and type `192.168.1.200:8080` into the search bar, which should load the scouting app
-   Once the scouting app loads, select the app you want the tablet to run on the home screen (for example, the match scouting app)
-   Once the desired app is loaded, you can now unplug the tablet and start using it to scout

Once you load the scouting apps onto each tablet, you can unplug the tablets and let the scouters record data while being unconnected to the system. Data submitted on the tablets while not plugged into the system will remain stored on the tablet, until you reconnect the tablet and upload it.

To upload scouting data back to the scouting laptop:

-   Connect each tablet to the system via ethernet adapter (as pictured above)
-   In the desired scouting app, scroll to the bottom. You should see a small yellow button called "Resend All" with text above saying "Queue: _N_". The number of unsubmitted, stored matches will match the value of _N_
-   Click the yellow "Resend All" button at the bottom of the app. _N_ should go to 0
-   In the terminal on the scouting laptop, you should see a bunch (_N_ total lines) saying "Match data received for team _X_ match _Y_", for each of the _N_ matches that were stored on the tablet

## Exporting Data

To easily use the collected, we provide a python script to convert our database contents to a CSV file.

To export all currently collected data, do the following:

-   Open the `scouting-app-2025` folder in VSCode. Once open, create a new terminal (`Terminal` > `New Terminal`). **Press 'New Terminal' twice to create two separate terminals, which should show up as separate tabs on the bottom right of your screen.**
-   In the first terminal, _as long as the scouting app isn't currently running on the laptop_, run `npm run start` to start the backend application
-   Switch to the second terminal without stopping `npm` from the first. In the second terminal, run the command `cd data-analysis`
-   Run the command `python -m venv venv` to create a new Python virtual environment
-   Load in the virtual environment. On **Linux**, do this by running `. venv/bin/activate`. On **Windows**, do this by running `Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser`, then `.\venv\Scripts\Activate.ps1`
-   Run the command `pip install -r requirements.txt`
-   Once complete, run `python export_csv.py`. This should generate 4 CSV files and drop them in the `data-analysis` directory
-   For each of the CSV files, you can now upload these to Google Drive and treat them like a normal spreadsheet.
-   Whenever data changes, re-run the `python export_csv.py` command to refresh the CSVs, and re-upload them to Google Drive.

## Development

These instructions are specific to users who want to develop in the system. **Never run the system in dev mode at competition, as this can cause loss of data!**

### Running the Client/Server

1. Running the client

```
npm run dev --workspace client
```

2. Running the server

```
npm run dev --workspace server
```

3. Running both the server and the client

```
npm run dev
```

### Generate Fake Data

If you don't have real scouting data to use to test the picklist interface/other interfaces, run the following to generate some fake data:

```
npm run --workspace server gen-fake-json
```
