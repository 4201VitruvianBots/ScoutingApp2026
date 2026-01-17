import numpy as np
import pandas as pd

# Load data
match_df = pd.read_csv("test.matchapps.csv")
super_df = pd.read_csv("test.superapps.csv")
DEBUG = False

# ---------------------------
# Data Cleaning and Adjustments
# ---------------------------

# Display rows with unusually high scores (optional)
match_df[
    (match_df["autoCoral.L1"] > 5) |
    (match_df["autoCoral.L2"] > 5) |
    (match_df["autoCoral.L3"] > 5) |
    (match_df["autoCoral.L4"] > 5) |
    (match_df["teleCoral.L1"] > 10) |
    (match_df["teleCoral.L2"] > 10) |
    (match_df["teleCoral.L3"] > 10) |
    (match_df["teleCoral.L4"] > 10)
][
    ["metadata.robotTeam", "metadata.matchNumber"] +
    [f"autoCoral.L{x}" for x in range(1, 5)] +
    [f"teleCoral.L{x}" for x in range(1, 5)]
]

# Fix known error at index 335
match_df.loc[335, "teleCoral.L1"] = 4
match_df.loc[335, "teleCoral.L3"] = 8

# ---------------------------
# Adding New Fields
# ---------------------------
match_df["autoScore"] = (
    match_df["leftStartingZone"] * 3 +
    match_df["autoCoral.L1"] * 3 +
    match_df["autoCoral.L2"] * 4 +
    match_df["autoCoral.L3"] * 6 +
    match_df["autoCoral.L4"] * 7 +
    match_df["autoAlgae.processor"] * 6 +
    match_df["autoAlgae.netRobot"] * 4
)

match_df["teleScore"] = (
    match_df["teleCoral.L1"] * 2 +
    match_df["teleCoral.L2"] * 3 +
    match_df["teleCoral.L3"] * 4 +
    match_df["teleCoral.L4"] * 5 +
    match_df["teleAlgae.processor"] * 6 +
    match_df["teleAlgae.netRobot"] * 4
)

match_df["climb.park"] = match_df["climb"] == "park"
match_df["climb.shallow"] = match_df["climb"] == "shallow"
match_df["climb.deep"] = match_df["climb"] == "deep"

match_df["endgameScore"] = (
    match_df["climb.park"] * 2 +
    match_df["climb.shallow"] * 6 +
    match_df["climb.deep"] * 12
)

match_df["totalScore"] = match_df["autoScore"] + match_df["teleScore"] + match_df["endgameScore"]

# Auto reef scoring flags
match_df["metadata.robotColorIsBlue"] = (
    (match_df["metadata.robotPosition"] == "blue_1") |
    (match_df["metadata.robotPosition"] == "blue_2") |
    (match_df["metadata.robotPosition"] == "blue_3")
)

match_df["autoScoreRightReef"] = (
    (match_df["metadata.robotColorIsBlue"] & (match_df["placement.deposit1"] | match_df["placement.deposit6"])) |
    ((~match_df["metadata.robotColorIsBlue"]) & (match_df["placement.deposit3"] | match_df["placement.deposit4"]))
)

match_df["autoScoreLeftReef"] = (
    (match_df["metadata.robotColorIsBlue"] & (match_df["placement.deposit3"] | match_df["placement.deposit4"])) |
    ((~match_df["metadata.robotColorIsBlue"]) & (match_df["placement.deposit1"] | match_df["placement.deposit6"]))
)

# ---------------------------
# Build unified team DataFrame
# ---------------------------
teams_from_match = match_df["metadata.robotTeam"].dropna().unique()
teams_from_super = super_df["metadata.robotTeam"].dropna().unique()
all_teams = np.union1d(teams_from_match, teams_from_super)
team_df = pd.DataFrame(index=all_teams)

# ---------------------------
# Aggregating Average Metrics
# ---------------------------
AVG_COLUMNS = (
    [f"startingZone.start{x}" for x in range(1, 4)] +
    [f"pickupLocation.source{x}" for x in range(1, 3)] +
    [f"pickupLocation.ground{x}" for x in range(1, 4)] +
    [f"placement.deposit{x}" for x in range(1, 7)] +
    ["climb.park", "climb.shallow", "climb.deep", "autoScoreRightReef", "autoScoreLeftReef"]
)
for c in AVG_COLUMNS:
    team_df[f"{c}.avg"] = match_df.groupby("metadata.robotTeam")[c].mean()

# ---------------------------
# Helper for Trimmed Statistics
# ---------------------------
def trimmed_stats(series, n):
    if len(series) > 2 * n:
        trimmed = series.sort_values().iloc[n:-n]
    else:
        trimmed = series
    return pd.Series({
        'min': trimmed.min(),
        'max': trimmed.max(),
        'avg': trimmed.mean(),
        'std': trimmed.std()
    })

# ---------------------------
# Aggregating Statistical Metrics (with trimmed calculations)
# ---------------------------
STAT_COLUMNS = (
    [f"autoCoral.L{x}" for x in range(1, 5)] +
    [f"teleCoral.L{x}" for x in range(1, 5)] +
    ["autoAlgae.netRobot", "autoAlgae.processor", "autoAlgae.remove"] +
    ["teleAlgae.netRobot", "teleAlgae.processor", "teleAlgae.remove"] +
    ["autoScore", "teleScore", "endgameScore", "totalScore"]
)
for c in STAT_COLUMNS:
    group = match_df.groupby("metadata.robotTeam")[c]
    team_df[f"{c}.min"] = group.min()
    team_df[f"{c}.max"] = group.max()
    team_df[f"{c}.avg"] = group.mean()
    team_df[f"{c}.std"] = group.std()

    for n in range(1, 3):
        # Unstack the multi-index Series to get a DataFrame with one row per team.
        stats = group.apply(lambda x: trimmed_stats(x, n)).unstack()
        team_df[f"{c}.min.drop{n}"] = stats["min"]
        team_df[f"{c}.max.drop{n}"] = stats["max"]
        team_df[f"{c}.avg.drop{n}"] = stats["avg"]
        team_df[f"{c}.std.drop{n}"] = stats["std"]


# ---------------------------
# Aggregating Data from super_df (Fouls and Breaks)
# ---------------------------
fouls = super_df[[ "fouls.insideRobot",
                   "fouls.protectedZone",
                   "fouls.pinning",
                   "fouls.multiplePieces",
                   "fouls.cageFoul",
                   "fouls.other" ]].sum(axis=1)
team_df["fouls.avg"] = fouls.groupby(super_df["metadata.robotTeam"]).mean()

breaks = super_df[[ "break.mechanismDmg",
                    "break.batteryFall",
                    "break.commsFail" ]].sum(axis=1)
team_df["break.avg"] = breaks.groupby(super_df["metadata.robotTeam"]).mean()

# ---------------------------
# Defense Metrics from super_df
# ---------------------------
def safeDivide(a, b):
    return 0 if b == 0 else a / b

# Initialize defense metric columns
team_df["Percent of Matches with No Defense"] = np.nan
team_df["Percent of Matches with Some Defense"] = np.nan
team_df["Percent of Matches with Full Defense"] = np.nan
team_df["Main Defense Type"] = None

team_list = [team for team in match_df["metadata.robotTeam"].unique() if not pd.isna(team)]
for team in team_list:
    defense_type_list = super_df.loc[super_df["metadata.robotTeam"] == team, "defense"].tolist()
    no_defense_count = defense_type_list.count("noDef")
    some_defense_count = defense_type_list.count("someDef")
    full_defense_count = defense_type_list.count("fullDef")
    defense_total_count = no_defense_count + some_defense_count + full_defense_count

    team_df.at[team, "Percent of Matches with No Defense"] = safeDivide(no_defense_count, defense_total_count)
    team_df.at[team, "Percent of Matches with Some Defense"] = safeDivide(some_defense_count, defense_total_count)
    team_df.at[team, "Percent of Matches with Full Defense"] = safeDivide(full_defense_count, defense_total_count)
    
    biggest_defense_count = max(no_defense_count, some_defense_count, full_defense_count)
    main_defense_type = ""
    if biggest_defense_count == no_defense_count:
        main_defense_type += "No Defense "
    if biggest_defense_count == some_defense_count:
        main_defense_type += "Some Defense "
    if biggest_defense_count == full_defense_count:
        main_defense_type += "Full Defense"
    team_df.at[team, "Main Defense Type"] = main_defense_type.strip()

# ---------------------------
# Export results
# ---------------------------
team_df.to_csv("updated_caph_2025_sat_full.csv")
