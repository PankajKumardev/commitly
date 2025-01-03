import { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const { repository, accessToken } = req.body;

  if (!repository || !accessToken) {
    return res
      .status(400)
      .json({ error: 'Repository and access token are required.' });
  }

  const webhookUrl = `https://api.github.com/repos/${repository}/hooks`;

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        Authorization: `token ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: 'web',
        active: true,
        events: ['issues', 'pull_request'], // Events to listen for
        config: {
          url: `${process.env.WEBHOOK_HANDLER_URL}/api/webhooks/github`, // Your webhook handler URL
          content_type: 'json',
          secret: process.env.GITHUB_WEBHOOK_SECRET,
        },
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      return res
        .status(500)
        .json({ error: 'Failed to create webhook', details: error });
    }

    const data = await response.json();
    res
      .status(200)
      .json({ message: 'Webhook created successfully', webhook: data });
  } catch (error) {
    console.error('Error creating webhook:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
}
