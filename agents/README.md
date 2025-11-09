# FollowUp Agents

This folder contains the NeuralSeek agent definitions used by the FollowUp application.

## Agent Files

Each agent has two files:
- `.json` - OpenAPI schema definition for the agent
- `.ntl` - NeuralSeek Template Language script for the agent

## Agents

- **BigAgent** - Main agent that orchestrates all other agents
- **FollowUpSummarizer** - Summarizes meeting transcripts
- **FollowUpNextTasks** - Extracts next tasks/action items from meetings
- **FollowUpEmail** - Generates follow-up emails
- **FollowUpCalendar** - Creates calendar events from meeting discussions
- **FollowUpBlockers** - Identifies blockers and issues from meetings

## Usage

These agents are configured in NeuralSeek and called via the Supabase Edge Function `analyze-meeting`. The agents are referenced by name in the function code.

