--[[
  [Stats] WebReporter
  Place this as a Script inside ServerScriptService.
  It fires after each game (when Quarter goes to "---")
  and pushes each player's averages to the RPL website.

  SETUP:
  1. In Roblox Studio → Game Settings → Security
     → Enable "Allow HTTP Requests"
  2. Set WEBSITE_URL and ROBLOX_SECRET below.
     ROBLOX_SECRET must match the ROBLOX_SECRET
     environment variable you set in Vercel.
]]

local HttpService = game:GetService("HttpService")
local Players     = game:GetService("Players")
local RS          = game:GetService("ReplicatedStorage")
local SSS         = game:GetService("ServerScriptService")

-- ── CONFIG ──────────────────────────────────────────
local WEBSITE_URL   = "https://rpldatabase.vercel.app/api/update"
local ROBLOX_SECRET = "REPLACE_WITH_YOUR_SECRET"  -- must match Vercel env var
-- ────────────────────────────────────────────────────

local Averages = require(SSS:WaitForChild("[Stats] Averages"))
local SBConfig = RS:WaitForChild("[Configuration] SB")
local Quarter  = SBConfig:WaitForChild("Quarter")
local HomeTeam = RS:WaitForChild("HomeTeam")
local AwayTeam = RS:WaitForChild("AwayTeam")
local HomeStats = RS:WaitForChild("[Stats] Home")
local AwayStats = RS:WaitForChild("[Stats] Away")

local lastQuarter    = Quarter.Value
local reportSent     = false

local function pushPlayerToSite(plr)
	if not plr then return end

	local avgs = Averages.GetAverages(plr)
	if not avgs then
		warn("[WebReporter] No averages for", plr.Name)
		return
	end

	local payload = {
		username = plr.Name,
		stats = {
			GP   = avgs.GP   or 0,
			PPG  = avgs.PPG  or 0,
			APG  = avgs.APG  or 0,
			RPG  = avgs.RPG  or 0,
			SPG  = avgs.SPG  or 0,
			BPG  = avgs.BPG  or 0,
			TOPG = avgs.TOPG or 0,
			FTPG = avgs.FTPG or 0,
			FG   = avgs.FG   or 0,
			FT   = avgs.FT   or 0,
			["3PT"] = avgs["3PT"] or 0,
			["2PT"] = avgs["2PT"] or 0,
		}
	}

	local ok, err = pcall(function()
		HttpService:PostAsync(
			WEBSITE_URL,
			HttpService:JSONEncode(payload),
			Enum.HttpContentType.ApplicationJson,
			false,
			{ Authorization = "Bearer " .. ROBLOX_SECRET }
		)
	end)

	if ok then
		print("[WebReporter] Pushed stats for", plr.Name)
	else
		warn("[WebReporter] Failed to push stats for", plr.Name, "-", err)
	end
end

local function pushAllPlayersToSite()
	if reportSent then return end
	reportSent = true

	-- Small delay so CommitGame (in the Averages handler) finishes first
	task.wait(3)

	local function processFolder(folder)
		for _, statChild in ipairs(folder:GetChildren()) do
			local plr = Players:FindFirstChild(statChild.Name)
			if plr then
				task.spawn(pushPlayerToSite, plr)
				task.wait(0.1) -- small stagger to avoid rate-limits
			end
		end
	end

	processFolder(HomeStats)
	processFolder(AwayStats)

	warn("[WebReporter] All players pushed to site.")
end

Quarter.Changed:Connect(function(newVal)
	-- Game just ended (Quarter flipped to "---" from 4TH or OT)
	if newVal == "---" and (lastQuarter == "4TH" or lastQuarter == "OT") then
		pushAllPlayersToSite()
	end
	-- New game started: reset the guard
	if newVal == "1ST" then
		reportSent = false
	end
	lastQuarter = newVal
end)

print("[WebReporter] Loaded. Will push stats to", WEBSITE_URL, "at end of each game.")
