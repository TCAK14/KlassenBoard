const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*'
  };

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
              name: 'KlassenBoard Pro',
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
        success_url: BASE_URL + '/landing?success=pro',
        cancel_url: BASE_URL + '/landing#preise',
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
              name: 'KlassenBoard Schullizenz',
              description: n + ' Lehrkräfte – Jahreslizenz'
            },
            unit_amount: totalCents,
            recurring: { interval: 'year' }
          },
          quantity: 1
        }],
        success_url: BASE_URL + '/landing?success=school',
        cancel_url: BASE_URL + '/landing#preise',
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
