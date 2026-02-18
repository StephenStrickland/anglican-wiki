// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

// https://astro.build/config
export default defineConfig({
	site: 'https://anglican.wiki',
	integrations: [
		starlight({
			title: 'Anglican Wiki',
			components: {
				PageTitle: './src/components/PageTitle.astro',
			},
			customCss: [
				'@fontsource/eb-garamond/400.css',
				'@fontsource/eb-garamond/700.css',
				'./src/styles/custom.css',
			],
			social: [{ icon: 'github', label: 'GitHub', href: 'https://github.com/StephenStrickland/anglican-wiki' }],
			sidebar: [
				{
					label: 'Books of Common Prayer',
					items: [
						{ label: 'BCP 1662', slug: 'bcp-1662' },
						{ label: 'BCP 1770 — Church Catechism', slug: 'bcp-1770/church-catechism' },
						{ label: 'BCP 1928', slug: 'bcp-1928' },
						{ label: 'BCP 2019', slug: 'bcp-2019' },
					],
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
				{
					label: 'Resources',
					autogenerate: { directory: 'resources' },
				},
			],
		}),
	],
});
