### Global vs Local

If you prefer, you can install Nexus globally and then use the global CLI to work with local Nexus projects. This is safe because the global CLI will hands off execution to the locally installed version of Nexus. For example:

<div class="TightRow">

```cli
npm install --global nexus@next
```

```cli
yarn global add nexus@next
```

</div>

```cli
cd my-project
```

```cli
nexus dev
```

This is just a convenience. It is equivilant to:

<div class="TightRow">

<div>

```json
"scripts": {
  "nexus:dev": "nexus dev"
}
```

```cli
npm run nexus:dev
```

</div>
<div>

```cli
yarn nexus dev
```

</div>
</div>

If you have not installed your project dependencies then the handoff will fail and tell you to do so. In other words a globally installed Nexus will never allow its version to be what is actually running your project. This protects you from unwittingly running a project with a different version of Nexus than you have installed in that project.
