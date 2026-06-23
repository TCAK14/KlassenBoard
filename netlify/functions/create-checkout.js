const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

exports.handler = async (event) => {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': 'https://klassenboard.netlify.app',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: 'Method Not Allowed' };
  }

  try {
    const { plan, teachers = 5, email } = JSON.parse(event.body);
    const isYearly = plan === 'pro-yearly';
    const BASE_URL = 'https://klassenboard.netlify.app';

    let session;

    if (plan === 'pro-monthly' || plan === 'pro-yearly') {
      session = await stripe.checkout.sessions.create({
        mode: 'subscription',
        locale: 'de',
        customer_email: email || undefined,
        line_items: [{
          price_data: {
            currency: 'eur',
            product_data: {
              name: 'ClassPuls Pro',
              description: isYearly ? 'Einzellizenz – Jahresabo' : 'Einzellizenz – Monatsabo',
              images: []
            },
            unit_amount: isYearly ? 2200 : 250,
            recurring: { interval: isYearly ? 'year' : 'month' }
          },
          quantity: 1
        }],
        subscription_data: {
          trial_period_days: 14
        },
        success_url: BASE_URL + '/landing.html?success=pro',
        cancel_url: BASE_URL + '/landing.html#preise',
      });

    } else if (plan === 'school') {
      const n = Math.max(1, parseInt(teachers));
      const totalCents = (88 + Math.max(0, n - 5) * 15) * 100;

      session = await stripe.checkout.sessions.create({
        mode: 'subscription',
        locale: 'de',
        customer_email: email || undefined,
        line_items: [{
          price_data: {
            currency: 'eur',
            product_data: {
              name: 'ClassPuls Schullizenz',
              description: n + ' Lehrkräfte – Jahreslizenz'
            },
            unit_amount: totalCents,
            recurring: { interval: 'year' }
          },
          quantity: 1
        }],
        success_url: BASE_URL + '/landing.html?success=school',
        cancel_url: BASE_URL + '/landing.html#preise',
      });
    } else {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Unbekannter Plan' }) };
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ url: session.url })
    };

  } catch (err) {
    console.error('Stripe error:', err.message);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: err.message })
    };
  }
};
