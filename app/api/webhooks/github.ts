import { NextApiRequest, NextApiResponse } from 'next';
import prisma from '../../../lib/prisma'; // Ensure prisma client is initialized properly
import crypto from 'crypto';

const GITHUB_WEBHOOK_SECRET = process.env.GITHUB_WEBHOOK_SECRET || '';

type GitHubIssuePayload = {
  action: string;
  issue: {
    id: number;
    title: string;
    body: string;
    user: { id: string; login: string };
  };
  repository: { id: number; name: string };
};

type GitHubPullRequestPayload = {
  action: string;
  pull_request: {
    id: number;
    title: string;
    body: string;
    user: { id: string; login: string };
    merged: boolean;
  };
  repository: { id: number; name: string };
};

// Helper to validate the webhook signature
function validateSignature(
  payload: string,
  signature: string | string[] | undefined
) {
  if (!signature || typeof signature !== 'string') return false;
  const hmac = crypto.createHmac('sha256', GITHUB_WEBHOOK_SECRET);
  const digest = `sha256=${hmac.update(payload).digest('hex')}`;
  return crypto.timingSafeEqual(Buffer.from(digest), Buffer.from(signature));
}

// Main handler for GitHub webhooks
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const signature = req.headers['x-hub-signature-256'];
  const event = req.headers['x-github-event'] as string;

  // Validate the signature
  const isValid = validateSignature(JSON.stringify(req.body), signature);
  if (!isValid) {
    return res.status(401).json({ error: 'Invalid signature' });
  }

  // Handle the specific GitHub events (issue, PR)
  try {
    switch (event) {
      case 'issues':
        await handleIssueEvent(req.body as GitHubIssuePayload);
        break;
      case 'pull_request':
        await handlePullRequestEvent(req.body as GitHubPullRequestPayload);
        break;
      default:
        console.log(`Unhandled event type: ${event}`);
        return res.status(400).json({ error: `Unhandled event: ${event}` });
    }

    res.status(200).json({ message: 'Webhook processed successfully' });
  } catch (error) {
    console.error('Error handling webhook:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
}

// Handle issue events
async function handleIssueEvent(payload: GitHubIssuePayload) {
  const { action, issue } = payload;

  // Action can be opened or closed
  if (action === 'opened' || action === 'closed') {
    await prisma.issue.upsert({
      where: { id: issue.id },
      create: {
        id: issue.id,
        title: issue.title,
        description: issue.body,
        status: action === 'opened' ? 'Open' : 'Closed',
        userId: await getUserIdByGitHubId(issue.user.id),
      },
      update: {
        status: action === 'opened' ? 'Open' : 'Closed',
      },
    });
  }
}

// Handle pull request events
async function handlePullRequestEvent(payload: GitHubPullRequestPayload) {
  const { action, pull_request } = payload;

  if (action === 'opened' || action === 'closed' || action === 'merged') {
    await prisma.pullRequest.upsert({
      where: { id: pull_request.id },
      create: {
        id: pull_request.id,
        title: pull_request.title,
        description: pull_request.body,
        status:
          action === 'opened'
            ? 'Open'
            : action === 'closed'
            ? 'Closed'
            : 'Merged',
        merged: action === 'merged',
        userId: await getUserIdByGitHubId(pull_request.user.id),
      },
      update: {
        status:
          action === 'opened'
            ? 'Open'
            : action === 'closed'
            ? 'Closed'
            : 'Merged',
        merged: action === 'merged',
      },
    });
  }
}

// Helper function to map GitHub user ID to the local user ID
async function getUserIdByGitHubId(githubId: string): Promise<number | null> {
  const user = await prisma.user.findUnique({
    where: { githubId: githubId },
  });
  return user?.id || null;
}
