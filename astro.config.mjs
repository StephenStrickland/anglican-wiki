// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

// https://astro.build/config
export default defineConfig({
	site: 'https://anglican.wiki',
	integrations: [
		starlight({
			title: 'Anglican Wiki',
			customCss: [
				'@fontsource/eb-garamond/400.css',
				'@fontsource/eb-garamond/700.css',
				'./src/styles/custom.css',
			],
			social: [{ icon: 'github', label: 'GitHub', href: 'https://github.com/StephenStrickland/anglican-wiki' }],
			sidebar: [
				{
					label: 'BCP 1770',
					autogenerate: { directory: 'bcp-1770' },
				},
				{
					label: 'Anglican Divines',
					items: [
						{
							label: 'John Jewel',
							items: [
								{ slug: 'anglican-divines/john-jewel' },
								{
									label: 'Apology of the Church of England',
									collapsed: true,
									autogenerate: { directory: 'anglican-divines/john-jewel/apology' },
								},
							],
							collapsed: true,
						},
					],
				},
			],
		}),
	],
});
